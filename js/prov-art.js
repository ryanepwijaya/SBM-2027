// Ilustrasi garis ikon provinsi untuk kotak di Biaya Per Wilayah (digambar sendiri, kotak 100×100).
// Ditampilkan samar di sisi kanan kotak, diperbesar dan terpotong sehingga yang terlihat bagian atas-kirinya.
// Bagian khas ikon (puncak, menara, kubah) diletakkan di separuh atas.

const arches = (from, to, step, y, w = 5, h = 8, skip = []) => {
  let d = '';
  for (let x = from; x <= to; x += step) if (!skip.some(([a, b]) => x >= a && x <= b)) d += `M${x} ${y + h}V${y + w / 2}a${w / 2} ${w / 2} 0 0 1 ${w} 0V${y + h}`;
  return d;
};

// Stupa kecil berbentuk lonceng dengan puncak
const stupa = (x, y, r) => `M${x - r} ${y}C${x - r} ${y - r * 1.7} ${x + r} ${y - r * 1.7} ${x + r} ${y}ZM${x} ${y - r * 1.28}V${y - r * 2}`;

// Kubah bawang (onion dome) dengan puncak
const onion = (x, y, r) => `M${x - r} ${y}C${x - r * 1.2} ${y - r * 1.1} ${x - r * 0.3} ${y - r * 1.5} ${x} ${y - r * 2.2}C${x + r * 0.3} ${y - r * 1.5} ${x + r * 1.2} ${y - r * 1.1} ${x + r} ${y}ZM${x} ${y - r * 2.2}V${y - r * 2.9}`;
// Gantungan jembatan dari kurva kuadrat (x0,y0)–(cx,cy)–(x1,y1) ke lantai jembatan
const hangers = (x0, y0, cx, cy, x1, y1, deck, n) => {
  let d = '';
  for (let i = 1; i < n; i++) {
    const t = i / n, x = (1 - t) ** 2 * x0 + 2 * t * (1 - t) * cx + t * t * x1, y = (1 - t) ** 2 * y0 + 2 * t * (1 - t) * cy + t * t * y1;
    if (y < deck - 1) d += `M${x.toFixed(1)} ${y.toFixed(1)}V${deck}`;
  }
  return d;
};
// Ombak di permukaan air
const waves = (y, x0 = 2, x1 = 98, w = 12, a = 3.5) => {
  let d = `M${x0} ${y}`;
  for (let x = x0; x < x1; x += w) d += `q${w / 4} ${-a} ${w / 2} 0t${w / 2} 0`;
  return d;
};
// Tiang rumah panggung
const stilts = (from, to, step, y0, y1) => { let d = ''; for (let x = from; x <= to; x += step) d += `M${x} ${y0}V${y1}`; return d; };

export const PROV_ART = {
  // DKI Jakarta: Monas
  dki: `<path d="M8 90H92M18 90L26 80H74L82 90M26 80L31 73H69L74 80M44.5 73L47.4 26M55.5 73L52.6 26M45.5 26H54.5M46.5 22.5H53.5V26H46.5Z"/>
    <path d="M50 22.5C45.5 21 45 15.5 48.6 10.5C48.2 13.6 49.6 14.6 50.8 12.6C51.4 15.6 55.2 16.4 53.8 20.2C53.2 21.6 51.8 22.5 50 22.5Z"/>
    <path d="M46.2 50H53.8M46.8 40H53.2"/>`,
  // Jawa Barat: Gedung Sate
  jabar: `<path d="M4 90V64H96V90M2 64L8 57H92L98 64M37 57V47H63V57M33 47L39 41H61L67 47M37 41L42 35H58L63 41M41 35L45.5 30H54.5L59 35M50 30V7"/>
    <circle cx="50" cy="26.5" r="1.7"/><circle cx="50" cy="22" r="1.7"/><circle cx="50" cy="17.5" r="1.7"/><circle cx="50" cy="13" r="1.7"/><circle cx="50" cy="8.8" r="1.4"/>
    <path d="M45.5 90V80a4.5 4.5 0 0 1 9 0V90${arches(9, 87, 8, 69, 4, 9, [[40, 56]])}"/>`,
  // Jawa Tengah: Borobudur
  jateng: `<path d="M4 90H96M8 90V84H92V90M13 84V78H87V84M18 78V72H82V72V78M23 72V67H77V72"/>
    <path d="${[22, 34, 46, 58, 70].map((x) => stupa(x + 4, 67, 4.2)).join('')}${[30, 42, 58, 70].map((x) => stupa(x, 60, 3.6)).join('')}M28 60H72"/>
    <path d="M37 60C37 46 42 41 50 40C58 41 63 46 63 60M44.5 40.5V36H55.5V40.5M46.5 36L48 30H52L53.5 36M48.4 30L50 11L51.6 30M48.9 24H51.1M49.3 18H50.7"/>`,
  // DI Yogyakarta: Tugu Jogja
  diy: `<path d="M28 90H72M32 90V82H68V90M36 82V75H64V82M42 75L44.2 42M58 75L55.8 42M42.6 64H57.4M43.4 53H56.6M43.6 42H56.4M44.6 42Q50 34.5 55.4 42"/>
    <path d="M50 37.5C47.2 31 48.6 21 50 8.5C51.4 21 52.8 31 50 37.5ZM48.6 30L51.4 27M48.4 24L51.6 21M48.8 18L51.2 15.6"/>`,
  // Jawa Timur: Gunung Bromo
  jatim: `<path d="M2 88H98M22 88L39 47Q50 43 61 47L78 88M39 47Q50 52.5 61 47M42.5 51L36 70M48 52.5L46 76M55 52L57.5 74M59.5 50L66 68"/>
    <path d="M2 88L13 64Q17 58 21 64L27 78M8 76L14 66M17 64L19 74"/>
    <path d="M48 45C42 38 52 33 46 25C42 19 50 13 46 6M54 45C59 38 52 31 58 23"/>`,
  // Banten: Mercusuar Cikoneng, Anyer
  banten: `<path d="M42 84L46 27M58 84L54 27M43 72H57M44 58H56M44.8 44H55.2M41 27H59M42 27V22.5M58 27V22.5M41 22.5H59M45 22.5V14H55V22.5M50 14V22.5M43.5 14L50 7.5L56.5 14M50 7.5V4.5M48 84V78H52V84M49 64H51V67H49ZM49.5 50H51.3V53H49.5Z"/>
    <path d="M4 89q6 -4 12 0t12 0t12 0t12 0t12 0t12 0t12 0t12 0M10 94q6 -3 12 0t12 0t12 0t12 0t12 0t12 0t12 0"/>`,

  // ===== Sumatra =====
  // Aceh: Masjid Raya Baiturrahman
  aceh: `<path d="M4 90H96M10 90V66H90V90M8 66H92M10 71H90${arches(14, 84, 7, 75, 4, 15, [[45, 52]])}M45 90V79a5 5 0 0 1 10 0V90"/>
    <path d="${onion(50, 60, 9)}${onion(30, 63, 5.5)}${onion(70, 63, 5.5)}M38 66V60H62V66M25 66V63H35V66M65 66V63H75V66"/>
    <path d="M88 90V34H94V90M87 34H95M88 40H94M88 56H94M88 72H94${onion(91, 30, 3.4)}"/>`,
  // Sumatra Utara: Rumah Bolon
  sumut: `<path d="M4 90H96M8 26Q50 50 92 26M8 26L20 62M92 26L80 62M20 62Q50 69 80 62M30 47L50 37L70 47M36 52L50 45L64 52M22 62V76H78V62M22 70H78${stilts(27, 75, 8, 76, 90)}"/>
    <path d="M44 76V68H56V76M30 66H38M62 66H70"/>`,
  // Riau: Istana Siak Sri Indrapura
  riau: `<path d="M4 90H96M10 90V58H90V90M10 74H90M8 58H92M38 58V40H62V58M37 40H63M38 40Q50 22 62 40M50 27V16${arches(15, 32, 6, 78, 4, 12)}${arches(64, 82, 6, 78, 4, 12)}${arches(15, 32, 6, 62, 4, 9)}${arches(64, 82, 6, 62, 4, 9)}M44 90V80a6 6 0 0 1 12 0V90${arches(42, 54, 6, 46, 4, 9)}"/>
    <path d="M10 58V48H20V58M80 58V48H90V58M10 48Q15 39 20 48M80 48Q85 39 90 48M15 42V37M85 42V37"/>`,
  // Kepulauan Riau: Jembatan Barelang (cable-stayed)
  kepri: `<path d="M0 64H100M0 68H100M28 84V16M33 84V16M28 26H33M28 50H33M67 84V16M72 84V16M67 26H72M67 50H72M18 68V84M50 68V84M82 68V84"/>
    <path d="M30.5 20L4 64M30.5 20L12 64M30.5 20L20 64M30.5 22L38 64M30.5 20L46 64M30.5 20L54 64M69.5 20L96 64M69.5 20L88 64M69.5 20L80 64M69.5 22L62 64"/>
    <path d="${waves(88)}"/>`,
  // Jambi: Candi Muaro Jambi
  jambi: `<path d="M4 90H96M10 90V81H90V90M16 81V72H84V81M23 72V63H77V72M30 63V55H70V63M37 55V47H63V55M42 47V41H58V47M43 41C43 33 57 33 57 41M50 35V27M45 90V47M55 90V47M45 84H55M45 78H55M45 72H55M45 66H55M45 60H55M45 54H55"/>`,
  // Sumatra Barat: Jam Gadang
  sumbar: `<path d="M4 90H96M32 90V80H68V90M38 80V38H62V80M38 60H62M44 80V70H56V80M43 66V62H57V66"/>
    <circle cx="50" cy="48" r="6.5"/><path d="M50 44V48L53 50"/>
    <path d="M36 38H64M36 38C30 33 30 28 26 20M64 38C70 33 70 28 74 20M40 34C38 29 38 25 35 18M60 34C62 29 62 25 65 18M42 32Q50 25 58 32M50 27C48 22 49 16 50 9C51 16 52 22 50 27"/>`,
  // Sumatra Selatan: Jembatan Ampera
  sumsel: `<path d="M0 60H100M0 64H100M27 86V12H35V86M65 86V12H73V86M27 18H35M65 18H73M35 16H65M35 26H65M35 16L42.5 26L50 16L57.5 26L65 16M29 30H33M67 30H71M29 40H33M67 40H71M0 50L27 46M100 50L73 46M5 50V60M12 49V60M19 48V60M81 48V60M88 49V60M95 50V60"/>
    <path d="${waves(84)}${waves(91, 8, 92)}"/>`,
  // Lampung: Menara Siger
  lampung: `<path d="M4 90H96M24 90V52H76V90M18 52H82M20 46H80M18 46L24 30L30 43L36 25L43 41L50 18L57 41L64 25L70 43L76 30L82 46M24 30V25M36 25V20M50 18V12M64 25V20M76 30V25"/>
    <path d="M30 60H40V68H30ZM45 60H55V68H45ZM60 60H70V68H60ZM30 74H40V82H30ZM60 74H70V82H60ZM45 90V74H55V90"/>`,
  // Bengkulu: Benteng Marlborough
  bengkulu: `<path d="M2 90H98M6 90V64L14 58H86L94 64V90M6 64H94M14 58V54H20V58M26 58V54H32V58M38 58V54H44V58M56 58V54H62V58M68 58V54H74V58M80 58V54H86V58M41 90V76Q50 66 59 76V90M34 54V44H66V54M32 44L50 34L68 44M50 34V18M50 18H60V24H50"/>
    <path d="M14 72H24M76 72H86"/>`,
  // Bangka Belitung: batu granit raksasa Tanjung Tinggi
  babel: `<path d="M10 82C6 70 14 60 26 62C30 52 44 50 50 58C54 44 70 40 76 52C88 52 94 64 90 78M26 62C30 66 30 74 26 80M50 58C48 64 50 72 54 78M76 52C72 58 72 68 76 74M54 46C52 34 60 26 68 30C74 33 76 42 72 48M62 32C60 38 62 44 66 48"/>
    <path d="${waves(84)}${waves(91, 8, 92)}"/>`,

  // ===== Bali dan Nusa Tenggara =====
  // Bali: candi bentar
  bali: `<path d="M4 90H96M8 90V76H13V68H18V60H23V52H28V44H32V36H36V28H39V20H42V90M92 90V76H87V68H82V60H77V52H72V44H68V36H64V28H61V20H58V90M42 90H58M44 85H56M46 80H54M13 76H42M18 68H42M23 60H42M28 52H42M32 44H42M36 36H42M87 76H58M82 68H58M77 60H58M72 52H58M68 44H58M64 36H58M40 20V14M60 20V14"/>`,
  // NTB: Gunung Rinjani
  ntb: `<path d="M2 88H98M2 88L22 60L34 38L42 22L48 30L54 26L62 40L76 58L98 88M42 22L40 44M48 30L50 46M54 26L60 48M30 44L26 62M66 46L72 64M34 58Q46 64 58 58Q46 54 34 58"/>
    <path d="M44 58C44 54 47 52 48 50C49 52 52 54 52 58"/>`,
  // NTT: Danau Kelimutu (tiga kawah)
  ntt: `<path d="M2 88H98M2 72Q14 50 30 50Q42 40 56 46Q70 40 84 50Q94 56 98 70M14 64L8 84M30 62L26 84M52 58L50 84M74 62L78 84M90 66L94 84"/>
    <path d="M18 56a9 3.6 0 1 0 18 0a9 3.6 0 1 0 -18 0ZM42 51a8.5 3.4 0 1 0 17 0a8.5 3.4 0 1 0 -17 0ZM66 56a9 3.6 0 1 0 18 0a9 3.6 0 1 0 -18 0Z"/>`,

  // ===== Kalimantan =====
  // Kalimantan Barat: Tugu Khatulistiwa
  kalbar: `<path d="M28 90H72M32 90V86H68V86V90M36 86V44M42 86V44M58 86V44M64 86V44M34 44H66M42 62H58V70H42Z"/>
    <circle cx="50" cy="30" r="11"/><path d="M39 30Q50 36 61 30M41 25Q50 29 59 25M50 19V41M26 30H78M74 26L78 30L74 34M50 41V44"/>`,
  // Kalimantan Tengah: Rumah Betang
  kalteng: `<path d="M2 90H98M4 54L14 40H86L96 54ZM8 54V68H92V54M8 61H92${stilts(12, 90, 8, 68, 90)}M47 68L43 90M53 68L49 90M45.6 74H51.6M44.6 80H50.6M43.6 86H49.6M18 44L82 44M14 40L50 30L86 40"/>
    <path d="M20 57H28M36 57H44M58 57H66M74 57H82"/>`,
  // Kalimantan Selatan: Rumah Banjar Bubungan Tinggi
  kalsel: `<path d="M2 90H98M30 58L50 12L70 58M36 58L50 24L64 58M50 12V5M8 64L30 52M92 64L70 52M8 64H92M12 64V80H88V64M12 72H88${stilts(16, 84, 8, 80, 90)}M44 80V68H56V80M20 68H28M72 68H80"/>`,
  // Kalimantan Timur: Jembatan Kutai Kartanegara (gantung)
  kaltim: `<path d="M0 62H100M0 66H100M24 84V18H29V84M71 84V18H76V84M24 28H29M71 28H76M26.5 20Q50 60 73.5 20M26.5 20Q14 30 0 50M73.5 20Q86 30 100 50${hangers(26.5, 20, 50, 60, 73.5, 20, 62, 10)}${hangers(26.5, 20, 13, 35, 0, 50, 62, 4)}${hangers(73.5, 20, 87, 35, 100, 50, 62, 4)}"/>
    <path d="${waves(84)}${waves(91, 8, 92)}"/>`,
  // Kalimantan Utara: Rumah Baloy
  kaltara: `<path d="M2 90H98M14 46L50 22L86 46M46 17L54 27M54 17L46 27M20 46V44M18 46V70H82V46M18 58H82${stilts(22, 78, 8, 70, 90)}M44 70L40 90M56 70L60 90M42.6 77H57.4M41.4 84H58.6M44 70V58H56V70M26 50H36V54H26ZM64 50H74V54H64Z"/>`,

  // ===== Sulawesi =====
  // Sulawesi Utara: Pulau dan Gunung Manado Tua
  sulut: `<path d="M12 80Q34 32 48 26Q52 24 56 27Q68 34 88 80M44 34L36 56M52 30L54 50M60 34L68 56M48 26Q52 22 56 27"/>
    <path d="M0 84Q10 78 22 80Q28 81 30 84"/>
    <path d="${waves(84)}${waves(91, 8, 92)}"/>`,
  // Gorontalo: Menara Limboto
  gorontalo: `<path d="M18 90H82M24 90Q38 62 45 30M76 90Q62 62 55 30M36 90Q50 72 64 90M32 68H68M39 50H61M44 34H56M45 30H55M47 30L48.5 14M53 30L51.5 14M47.5 14H52.5M50 14V5M30 78L38 68M70 78L62 68M34 68L42 50M66 68L58 50M42 50L46 34M58 50L54 34M38 68L50 58L62 68M41 50L50 42L59 50"/>`,
  // Sulawesi Barat: Perahu Sandeq
  sulbar: `<path d="M44 74V12M44 13L82 64H44M44 13L30 60H44M14 74Q50 82 88 72L84 78Q50 88 18 80ZM22 70H78M28 70L20 86M72 70L80 86M14 86H86"/>
    <path d="${waves(92, 4, 96, 10, 2.5)}"/>`,
  // Sulawesi Selatan: Kapal Pinisi
  sulsel: `<path d="M8 68L84 66L78 80Q46 86 16 80ZM84 66L98 58M38 68V12M60 67V16M39 16L52 20V58L39 60ZM61 20L74 24V56L61 58ZM60 16L96 58H62ZM38 12L24 62H38M14 72H80"/>
    <path d="${waves(88)}${waves(94, 8, 92)}"/>`,
  // Sulawesi Tengah: Rumah Souraja (Banua Oge)
  sulteng: `<path d="M2 90H98M8 50L50 20L92 50M28 44L50 28L72 44H28M34 44L50 33L66 44M50 20V14M14 50V72H86V50M14 61H86${stilts(18, 82, 8, 72, 90)}M44 72L40 90M56 72L60 90M42.4 79H57.6M41.2 85H58.8M22 54H30V58H22ZM70 54H78V58H70ZM44 72V62H56V72"/>`,
  // Sulawesi Tenggara: Benteng Keraton Buton
  sultra: `<path d="M2 88H98M2 76Q50 58 98 76M4 66L20 60L36 56L52 54L68 56L84 60L96 66M4 74L20 68L36 64L52 62L68 64L84 68L96 74M8 64.6V60.6M14 62.4V58.4M26 58.6V54.6M32 57V53M42 55.2V51.2M48 54.4V50.4M58 54.6V50.6M64 55.6V51.6M74 57.6V53.6M80 59V55M90 62.8V58.8"/>
    <path d="M14 66a7 5 0 0 1 14 0V71H14ZM61 60a7 5 0 0 1 14 0V66H61ZM48 63V58a4 4 0 0 1 8 0V63"/>`,

  // ===== Maluku dan Papua =====
  // Maluku: Benteng Belgica (Banda Neira)
  maluku: `<path d="M2 88H98M6 88L18 70H82L94 88ZM18 70L12 62H30L26 70M82 70L88 62H70L74 70M28 70V56H72V70M28 56H72M30 56V52H35V56M40 56V52H45V56M55 56V52H60V56M65 56V52H70V56M42 56V38H58V56M41 38H59M42 38V34H46V38M48 38V34H52V38M54 38V34H58V38M50 34V18M50 18H59V23H50M46 70V62H54V70"/>`,
  // Maluku Utara: Gunung Gamalama
  malut: `<path d="M8 80L40 28Q50 22 60 28L92 80M40 28Q50 32 60 28M44 33L36 56M50 32V58M56 33L64 56M30 50L24 66M70 50L76 66"/>
    <path d="M48 26C44 20 52 16 48 9M53 26C57 20 51 15 56 10"/>
    <path d="${waves(84)}${waves(91, 8, 92)}"/>`,
  // Papua: Jembatan Youtefa
  papua: `<path d="M0 66H100M0 70H100M10 66Q50 4 90 66M16 66Q50 14 84 66${hangers(10, 66, 50, 4, 90, 66, 66, 12)}M10 70V86M90 70V86M50 70V86"/>
    <path d="M0 52Q8 44 16 50M84 48Q92 42 100 48"/>
    <path d="${waves(88)}${waves(94, 8, 92)}"/>`,
  // Papua Barat: Rumah Kaki Seribu (Arfak)
  pabar: `<path d="M8 90H92M20 44L50 24L80 44ZM26 40L50 28L74 40M32 36L50 31L68 36M24 44V58H76V44M24 51H76${stilts(25, 75, 3.5, 58, 90)}M44 58V48H56V58"/>`,
  // Papua Barat Daya: gugusan karst Raja Ampat
  pbd: `<path d="M6 84C4 66 10 52 20 52C30 52 32 66 30 84M26 60C24 66 24 74 26 80M34 84C32 58 42 40 54 42C66 44 68 62 64 84M58 50C54 58 54 70 56 80M66 84C66 68 72 60 80 62C88 64 90 74 88 84M78 68C76 72 76 78 78 82M42 46C46 36 52 32 58 36"/>
    <path d="${waves(86)}${waves(93, 8, 92)}"/>`,
  // Papua Tengah: Puncak Jaya bersalju
  pateng: `<path d="M2 88H98M2 88L20 54L30 60L44 28L52 36L62 22L78 50L86 46L98 88M38 40L44 34L49 40L54 33L58 37L62 30L66 36M44 28L42 50M62 22L60 46M52 36L54 52M24 62L20 76M80 56L84 70"/>`,
  // Papua Selatan: Tugu Lingkaran Brawijaya (Libra) 969, Merauke
  pasel: `<path d="M8 90H92M14 90Q50 80 86 90M30 86V80H70V86M36 80V72H64V80M42 72L44 34M58 72L56 34M43 58H57M43.6 46H56.4M44 34H56M42 64H58"/>
    <circle cx="50" cy="24" r="9"/><path d="M41 24H59M50 15V33M43 18Q50 21 57 18M43 30Q50 27 57 30M50 33V34"/>`,
  // Papua Pegunungan: Honai
  papeg: `<path d="M4 88H96M14 88V64M54 88V64M10 66Q12 34 34 28Q56 34 58 66ZM14 54Q34 46 54 54M12 60Q34 54 56 60M18 44Q34 38 50 44M30 88V74Q34 70 38 74V88M34 28V22"/>
    <path d="M62 88V72M88 88V72M60 74Q62 54 75 50Q88 54 90 74ZM64 66Q75 62 86 66M71 88V80Q75 77 79 80V88"/>`,
};

export const provArt = (id) => (PROV_ART[id]
  ? `<svg class="prov-art" viewBox="0 0 100 100" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${PROV_ART[id]}</svg>`
  : '');
