// Katalog tampilan tahap 1: Perjalanan Dinas.
// Isi angka & teks regulasi berasal dari data/sbm.json (hasil ekstraksi KMK 296/2026 & PMK 54/2026).
// "Poin penting" di bawah adalah ringkasan dari Penjelasan KMK pada butir terkait.

export const GROUPS = [
  { id: 'dn', name: 'Perjalanan Dinas Dalam Negeri', short: 'Dalam Negeri' },
  { id: 'ln', name: 'Perjalanan Dinas Luar Negeri', short: 'Luar Negeri' },
  { id: 'pindah', name: 'Perjalanan Dinas Pindah', short: 'Pindah' },
];

// Setiap entri = satu "menu" yang dibuka pengguna. Satu butir KMK bisa punya >1 entri (mis. 25.1 dan 25.2).
export const ENTRIES = [
  {
    key: 'uh-dn', group: 'dn', butir: 'L1-25', table: 0, icon: 'wallet',
    name: 'Uang Harian Dalam Negeri', desc: 'Per provinsi: luar kota, dalam kota lebih dari 8 jam, dan diklat',
    syn: ['uang harian', 'uh', 'harian', 'uang saku', 'luar kota', 'dalam kota', '8 jam', 'delapan jam', 'diklat', 'pelatihan', 'lumpsum harian'],
    points: [
      'Diberikan per orang per hari (OH) menurut provinsi tujuan, dengan tiga besaran: luar kota, dalam kota lebih dari 8 jam, dan diklat.',
      'Jika perjalanan dinas luar kota memerlukan lebih dari satu lokasi tujuan dalam kabupaten/kota yang sama, transpor lokal dapat dibayar riil dan uang harian yang diberikan menjadi 60% dari satuan biaya.',
      'Uang harian diklat diberikan untuk diklat tatap muka (jalur pelatihan klasikal) yang diselenggarakan di dalam kota melebihi 8 jam atau di luar kota.',
    ],
  },
  {
    key: 'representasi', group: 'dn', butir: 'L1-25', table: 1, icon: 'award',
    name: 'Uang Representasi', desc: 'Pejabat negara/wamen, eselon I, eselon II — berlaku nasional',
    syn: ['representasi', 'uang representasi', 'eselon i', 'eselon ii', 'pejabat negara', 'wamen', 'wakil menteri'],
    points: [
      'Hanya untuk pejabat negara, wakil menteri, pejabat eselon I, dan pejabat eselon II yang melaksanakan perjalanan dinas jabatan dalam rangka tugas dan fungsi yang melekat pada jabatan.',
      'Besarannya sama untuk seluruh provinsi, dibedakan luar kota dan dalam kota lebih dari 8 jam.',
    ],
  },
  {
    key: 'penginapan', group: 'dn', butir: 'L1-27', table: 0, icon: 'hotel',
    name: 'Penginapan (Hotel)', desc: 'Tarif hotel per provinsi untuk 4 tingkat jabatan',
    syn: ['penginapan', 'hotel', 'inap', 'menginap', 'nginap', 'akomodasi', 'kamar', 'losmen', 'tarif hotel', 'golongan iii', 'golongan iv', 'gol iii', 'gol iv'],
    points: [
      'Batas tertinggi tarif hotel per orang per hari, menurut provinsi dan empat tingkat jabatan.',
      'Pertanggungjawaban berdasarkan bukti pengeluaran yang sah.',
      'Ajudan pimpinan lembaga negara/menteri dapat menginap di hotel yang sama dengan pimpinan; bila biayanya melebihi satuan biaya, ajudan menggunakan kamar dengan biaya terendah di hotel tersebut.',
      'Untuk kegiatan tertentu yang dihadiri sejumlah Kepala Negara/Kepala Pemerintahan, biaya penginapan dapat dibayar sesuai pengeluaran riil.',
    ],
  },
  {
    key: 'tiket-dn', group: 'dn', butir: 'L2-6', table: 0, icon: 'plane-takeoff',
    name: 'Tiket Pesawat Dalam Negeri', desc: '316 rute pergi pulang, kelas bisnis dan ekonomi',
    syn: ['tiket', 'pesawat', 'penerbangan', 'tiket pesawat', 'flight', 'maskapai', 'bisnis', 'ekonomi', 'pp', 'pulang pergi', 'pergi pulang', 'rute'],
    points: [
      'Satuan biaya tiket pesawat pergi pulang (PP) dari bandara kota keberangkatan ke bandara kota tujuan, kelas bisnis dan ekonomi.',
      'Sudah termasuk asuransi; tidak termasuk airport tax, bagasi, dan retribusi lainnya.',
      'Dalam pelaksanaan anggaran menggunakan metode biaya riil.',
    ],
    appNote: 'KMK mencantumkan setiap rute satu kali (kota asal – kota tujuan). Pencarian di aplikasi ini mencocokkan kedua arah.',
  },
  {
    key: 'taksi', group: 'dn', butir: 'L2-5', table: 0, icon: 'car-taxi-front',
    name: 'Taksi ke/dari Bandara, Stasiun, Terminal', desc: 'Sekali jalan per provinsi, metode lumpsum',
    syn: ['taksi', 'taxi', 'bandara', 'airport', 'stasiun', 'terminal', 'pelabuhan', 'transport bandara', 'transportasi bandara', 'antar jemput'],
    points: [
      'Untuk satu kali perjalanan menuju/dari terminal bus, stasiun, bandara, atau pelabuhan keberangkatan, atau dari tempat kedatangan menuju tempat di kota tujuan, dan sebaliknya.',
      'Dalam pelaksanaan anggaran menggunakan metode lumpsum.',
      'Bila memerlukan biaya melebihi satuan biaya, dapat dibayar riil sepanjang perjalanan dilakukan dari dan/atau ke kantor dan bukan menggunakan kendaraan pribadi.',
    ],
    appNote: 'Tabel KMK hanya memuat 34 provinsi. Papua Barat Daya, Papua Tengah, Papua Selatan, dan Papua Pegunungan tidak tercantum.',
  },
  {
    key: 'darat', group: 'dn', butir: 'L2-2', table: 0, icon: 'bus-front',
    name: 'Transport Darat Ibu Kota Provinsi ke Kabupaten/Kota', desc: 'Sekali jalan, 361 rute di 31 provinsi',
    syn: ['transport darat', 'transportasi darat', 'darat', 'kabupaten', 'kab', 'kota tujuan', 'antar kota', 'antarkota', 'travel', 'bus', 'ibu kota provinsi', 'ibukota'],
    points: [
      'Satuan biaya sekali jalan dari tempat kedudukan di ibu kota provinsi ke kabupaten/kota tujuan dalam provinsi yang sama, atau sebaliknya.',
      'Bila rute belum tercantum, biaya mengacu pada harga pasar (at cost) dengan tetap mempertimbangkan prinsip efisiensi dan efektivitas.',
    ],
    appNote: 'Tabel KMK memuat 31 provinsi. DKI Jakarta diatur tersendiri (transport ke Bodetabek); Kalimantan Utara, Maluku, Papua Barat Daya, Papua Tengah, Papua Selatan, dan Papua Pegunungan tidak tercantum.',
  },
  {
    key: 'bodetabek', group: 'dn', butir: 'L2-3', table: 0, icon: 'signpost',
    name: 'Transport Jakarta ke Bodetabek', desc: 'Bogor, Depok, Bekasi, Tangerang, Tangsel, Kep. Seribu',
    syn: ['bodetabek', 'jabodetabek', 'bekasi', 'bogor', 'depok', 'tangerang', 'tangsel', 'tangerang selatan', 'kepulauan seribu', 'pulau seribu', 'kota sekitar'],
    points: [
      'Satuan biaya sekali jalan dari tempat kedudukan di DKI Jakarta ke Kabupaten/Kota Bogor, Kota Depok, Kabupaten/Kota Bekasi, Kabupaten/Kota Tangerang, Kota Tangerang Selatan, dan Kepulauan Seribu, atau sebaliknya.',
      'Menggunakan metode lumpsum. Bila memerlukan biaya melebihi satuan biaya, dapat dibayar riil sepanjang perjalanan dari dan/atau ke kantor dan bukan menggunakan kendaraan pribadi.',
    ],
  },
  {
    key: 'dalam-kota', group: 'dn', butir: 'L2-4', table: 0, icon: 'map-pin',
    name: 'Transpor Kegiatan Dalam Kota (PP)', desc: 'Pergi pulang dalam satu kabupaten/kota — berlaku nasional',
    syn: ['transpor lokal', 'transport lokal', 'dalam kota', 'transpor kegiatan', 'transport kegiatan', 'transpor dalam kota', 'pp dalam kota'],
    points: [
      'Untuk kegiatan/pekerjaan di luar kantor dalam batas wilayah suatu kabupaten/kota, pergi pulang, yang berkaitan dengan tugas kantor dan tidak menggunakan kendaraan dinas.',
      'Tidak dapat diberikan untuk kegiatan dalam kompleks perkantoran yang sama.',
      'Bila memerlukan biaya melebihi satuan biaya (termasuk moda udara dan/atau air), dapat menggunakan harga pasar dan dibayar sesuai biaya riil.',
      'Bila instansi/unit penyelenggara tidak memberikan, instansi/unit pengirim dapat memberikannya.',
      'Khusus DKI Jakarta, satu kabupaten/kota meliputi Jakarta Pusat, Jakarta Timur, Jakarta Utara, Jakarta Barat, dan Jakarta Selatan.',
    ],
  },
  {
    key: 'rapat', group: 'dn', butir: 'L1-29', table: 0, icon: 'users',
    name: 'Rapat/Pertemuan di Luar Kantor', desc: 'Paket halfday, fullday, fullboard + uang harian fullboard',
    syn: ['rapat', 'paket meeting', 'meeting', 'paket rapat', 'fullboard', 'full board', 'fullday', 'full day', 'halfday', 'half day', 'konsinyering', 'konsinyasi', 'pertemuan', 'rapat luar kantor', 'fb', 'fd', 'hd'],
    points: [
      'Paket per orang (OP) menurut provinsi dan tiga tingkat peserta: menteri/setingkat menteri/wakil menteri; eselon I–II/pejabat fungsional utama; eselon III/pejabat fungsional madya ke bawah.',
      'Fullboard: sehari penuh dan menginap, di dalam maupun di luar kota. Fullday: paling singkat 8 jam tanpa menginap. Halfday: paling singkat 5 jam tanpa menginap.',
      'Tarif fullboard dihitung untuk 1 kamar berdua. Eselon II/pejabat fungsional utama ke atas mendapat 1 kamar sendiri dengan indeks paling tinggi 1,5 kali tarif fullboard.',
      'Halfday dan fullday hanya dapat dilaksanakan di dalam kota, kecuali melibatkan instansi atau masyarakat kabupaten/kota setempat.',
      'Uang harian rapat hanya untuk kegiatan fullboard dan yang hadir luring; halfday dan fullday tidak diberikan uang harian.',
      'Panitia dan peserta yang memerlukan waktu tambahan berangkat/pulang dapat diberi penginapan dan uang harian perjalanan dinas untuk 1 hari sebelum dan/atau sesudah kegiatan.',
    ],
  },
  {
    key: 'uh-ln', group: 'ln', butir: 'L1-26', table: 0, icon: 'globe',
    name: 'Uang Harian Luar Negeri', desc: 'Dalam US$ per negara, golongan A–D',
    syn: ['uang harian luar negeri', 'uh ln', 'luar negeri', 'ln', 'golongan a', 'golongan b', 'golongan c', 'golongan d', 'gol a', 'gol b', 'gol c', 'gol d', 'negara', 'usd', 'dolar', 'dollar'],
    points: [
      'Dalam US$ per orang per hari menurut negara dan golongan A–D. Dapat digunakan untuk biaya makan, transportasi lokal, operasional, dan penginapan.',
      'Negara yang tidak tercantum merujuk pada uang harian negara tempat Perwakilan RI yang bersangkutan berkedudukan (contoh: Uganda merujuk Kenya).',
      'Untuk rombongan yang tidak terpisahkan, golongan dapat ditetapkan mengikuti salah satu golongan agar Pelaksana SPD dapat menginap di tempat yang sama; golongan yang lebih rendah dapat dinaikkan 1 tingkat, atau lebih bila tidak mencukupi.',
      'Bila tidak mencukupi untuk penginapan pada kegiatan yang dihadiri sejumlah Kepala Negara/Kepala Pemerintahan, uang harian dibayar paling tinggi 30% dan penginapan sesuai pengeluaran riil.',
    ],
  },
  {
    key: 'tiket-ln', group: 'ln', butir: 'L2-7', table: 0, icon: 'plane-landing',
    name: 'Tiket Pesawat Luar Negeri', desc: 'Dalam US$, PP dari Jakarta, eksekutif/bisnis/ekonomi',
    syn: ['tiket luar negeri', 'tiket ln', 'pesawat luar negeri', 'eksekutif', 'first class'],
    points: [
      'Tiket pesawat pergi pulang (PP) dari bandara di Jakarta ke kota tujuan di luar negeri, dalam US$.',
      'Termasuk asuransi perjalanan selama dalam moda transportasi; tidak termasuk airport tax dan retribusi lainnya.',
      'Dalam pelaksanaan anggaran menggunakan metode biaya riil.',
    ],
  },
  {
    key: 'pengepakan', group: 'pindah', butir: 'L1-24', table: 0, icon: 'package-open',
    name: 'Pengepakan & Angkutan Barang Pindah DN', desc: 'Kereta api, truk, angkutan laut/sungai',
    syn: ['pindah', 'mutasi', 'pengepakan', 'angkutan barang', 'barang pindahan', 'pindahan', 'truk', 'kereta api', 'penggudangan'],
    points: [
      'Diberikan kepada pejabat negara/pegawai ASN yang dipindahtugaskan berdasarkan keputusan pejabat yang berwenang, sebagai bantuan dari pemerintah.',
      'Sudah termasuk ongkos tukang, pengadaan bahan-bahan, biaya bongkar muat, dan biaya angkutan barang dari tempat asal sampai dengan tujuan.',
    ],
  },
  {
    key: 'tiket-pindah-ln', group: 'pindah', butir: 'L1-28', table: 0, icon: 'luggage',
    name: 'Tiket Pindah Luar Negeri (One Way)', desc: 'Dalam US$, Jakarta ⇄ 132 perwakilan',
    syn: ['tiket pindah', 'pindah luar negeri', 'one way', 'perwakilan', 'cross posting', 'cross-posting', 'published', 'business', 'first'],
    points: [
      'Tiket pesawat sekali jalan (one way) untuk perjalanan dinas pindah dari/ke perwakilan RI di luar negeri, bagi pejabat/pegawai dan keluarga yang sah berdasarkan surat keputusan pindah.',
      'Termasuk asuransi; tidak termasuk airport tax serta retribusi lainnya.',
      'Pindah antarperwakilan (cross-posting) dapat mengikuti informasi dari perusahaan travel, ditetapkan oleh KPA/PPK, dengan memperhatikan efisiensi, efektivitas, kewajaran, dan kemampuan keuangan negara.',
    ],
  },
];

export const SHORTCUTS = ['uh-dn', 'penginapan', 'tiket-dn', 'taksi', 'rapat', 'darat', 'bodetabek', 'uh-ln'];

export const SIFAT = {
  BT: { label: 'Batas Tertinggi', cls: 'bt', text: 'Besaran biaya yang tidak dapat dilampaui (Pasal 2 ayat (3) PMK 54/2026).' },
  DL: { label: 'Dapat Dilampaui', cls: 'dl', text: 'Dapat dilampaui dalam pelaksanaan anggaran dengan mempertimbangkan harga pasar serta prinsip ekonomis, efisien, dan efektif (Pasal 2 ayat (4) PMK 54/2026).' },
};

export const KEL_ORDER = ['C', 'A', 'B', 'D', 'P', 'E'];

// Kata yang mengarah ke kelompok yang belum aktif (untuk pesan "belum tersedia")
export const SOON_SYN = {
  A: ['honor', 'honorarium', 'narasumber', 'narsum', 'moderator', 'panitia', 'pembawa acara', 'mc', 'tim pelaksana', 'honor tim', 'sekretariat', 'kpa', 'ppk', 'bendahara', 'pengelola keuangan', 'pengadaan', 'pokja', 'ukpbj', 'pnbp', 'sai', 'bmn', 'penelitian', 'rohaniwan', 'jurnal', 'artikel', 'ujian', 'vakasi', 'seleksi', 'pengajar', 'penceramah', 'modul', 'satpam', 'pengemudi', 'sopir', 'pramubakti', 'cleaning service', 'saksi ahli', 'penyuluh'],
  B: ['uang makan', 'lauk pauk', 'lembur', 'uang lembur', 'makan lembur', 'pakaian dinas', 'seragam', 'pdh', 'pdl', 'pdu'],
  D: ['konsumsi', 'konsumsi rapat', 'snack', 'kudapan', 'mamin', 'makan minum', 'sewa kendaraan', 'sewa mobil', 'rental', 'kendaraan dinas', 'mobil dinas', 'pengadaan kendaraan', 'daya tahan tubuh', 'extra fooding', 'operasional penyuluh', 'atk', 'kebutuhan dasar perkantoran', 'inventaris', 'meja kursi', 'sewa gedung', 'gedung pertemuan', 'fotokopi', 'fotocopy', 'penerjemahan', 'terjemah', 'pengetikan', 'bahan makanan', 'tahanan', 'perwakilan ri'],
  P: ['pemeliharaan', 'perawatan', 'servis', 'service', 'pemeliharaan gedung', 'pemeliharaan kendaraan', 'genset', 'ac', 'komputer', 'printer'],
  E: ['beasiswa', 'tugas belajar', 'magang', 'bbpa', 'pendidikan anak'],
};

export const DOC_NOTES = [
  { t: 'Taksi hanya 34 provinsi', x: 'Tabel satuan biaya transportasi dari/ke terminal bus/stasiun/bandara/pelabuhan (Lampiran II angka 5) tidak memuat Papua Barat Daya, Papua Tengah, Papua Selatan, dan Papua Pegunungan. Aplikasi menampilkan "Tidak tercantum", bukan Rp0.' },
  { t: 'Transport darat hanya 31 provinsi', x: 'Lampiran II angka 2 tidak memuat Kalimantan Utara, Maluku, dan empat provinsi Papua baru. DKI Jakarta diatur tersendiri di angka 3. Menurut Penjelasan, rute yang belum tercantum mengacu pada harga pasar (at cost).' },
  { t: 'Rute tiket ditulis satu arah', x: 'Tabel tiket pesawat dalam negeri mencantumkan setiap pasangan kota satu kali (asal – tujuan). Pencarian rute di aplikasi ini mencocokkan kedua arah.' },
  { t: 'Ejaan provinsi diseragamkan', x: 'KMK memakai "SUMATRA" dan "SUMATERA" secara bergantian, serta menulis sebagian nama dengan huruf berjarak (mis. "R I A U"). Aplikasi menyeragamkan penulisan nama provinsi agar pencarian dan perbandingan konsisten. Nomor dan angka tidak diubah.' },
  { t: 'Nama kabupaten/kota sesuai teks KMK', x: 'Beberapa nama ditulis apa adanya sesuai KMK, misalnya "Kab. Luwuk" dan "Kab. Tojouna-Una" (Sulawesi Tengah) serta "Memberamo". Aplikasi menampilkan teks sesuai KMK karena itu yang dikutip.' },
  { t: 'Baris "Kota Bojonegoro"', x: 'Lampiran II angka 2.15.32 mencantumkan "Kota Bojonegoro" (Rp225.000), padahal yang ada hanya Kabupaten Bojonegoro (tercantum di angka 2.15.4 dengan besaran yang sama). Fitur Rute memakai baris Kab. Bojonegoro.' },
  { t: 'Nama kabupaten di tabel transport darat yang berbeda dengan nama resmi', x: 'Untuk fitur Rute, aplikasi memetakan: Kab. Toba Samosir → Kab. Toba; Kab. Pali → Kab. Penukal Abab Lematang Ilir; Kab. Pangadaran → Kab. Pangandaran; Kab. Pulau Pisau → Kab. Pulang Pisau; Kab. Pahuwato → Kab. Pohuwato; Kab. Mamuju Utara → Kab. Pasangkayu; Kab. Luwuk → Kab. Banggai (Luwuk adalah ibu kota Kab. Banggai). Teks KMK tetap ditampilkan apa adanya di tabel.' },
  { t: 'Salah cetak di butir non-perjadin', x: 'Lampiran I angka 31: sub-butir tertulis 32.1–32.3. Angka 18.2: sub-butir tertulis 18.1.1 dan 18.2.1. Angka 18.3: judul tabel tertulis "Penyusunan Butir Soal", sedangkan Penjelasan menyebut honorarium Pelaksana Ujian Tingkat Nasional. Butir-butir ini akan ditandai saat kelompoknya diaktifkan.' },
];

// Alias tambahan kota tiket/ibu kota → bentuk di KMK
export const CITY_ALIAS = {
  'jogja': 'YOGYAKARTA', 'yogya': 'YOGYAKARTA', 'jogjakarta': 'YOGYAKARTA', 'jkt': 'JAKARTA', 'sby': 'SURABAYA',
  'bali': 'DENPASAR', 'lombok': 'MATARAM', 'pangkalpinang': 'PANGKAL PINANG', 'palangka raya': 'PALANGKARAYA',
  'balikpapan': 'BALIKPAPAN', 'surakarta': 'SOLO', 'ujung pandang': 'MAKASSAR', 'mks': 'MAKASSAR', 'mdn': 'MEDAN',
  'belitung': 'TANJUNG PANDAN', 'tolitoli': 'TOLI-TOLI',
};
