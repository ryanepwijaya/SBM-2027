// Ilustrasi garis ikon provinsi untuk kotak di Biaya Per Wilayah (digambar sendiri, kotak 100×100).
// Ditampilkan samar di sisi kanan kotak, diperbesar dan terpotong sehingga yang terlihat bagian atas-kirinya.
// Bagian khas ikon (puncak, menara, kubah) diletakkan di separuh atas.

const arches = (from, to, step, y, w = 5, h = 8, skip = []) => {
  let d = '';
  for (let x = from; x <= to; x += step) if (!skip.some(([a, b]) => x >= a && x <= b)) d += `M${x} ${y + h}V${y + w / 2}a${w / 2} ${w / 2} 0 0 1 ${w} 0V${y + h}`;
  return d;
};

export const PROV_ART = {
  // DKI Jakarta: Monas
  dki: `<path d="M8 90H92M18 90L26 80H74L82 90M26 80L31 73H69L74 80M44.5 73L47.4 26M55.5 73L52.6 26M45.5 26H54.5M46.5 22.5H53.5V26H46.5Z"/>
    <path d="M50 22.5C45.5 21 45 15.5 48.6 10.5C48.2 13.6 49.6 14.6 50.8 12.6C51.4 15.6 55.2 16.4 53.8 20.2C53.2 21.6 51.8 22.5 50 22.5Z"/>
    <path d="M46.2 50H53.8M46.8 40H53.2"/>`,
  // Jawa Barat: Gedung Sate
  jabar: `<path d="M4 90V64H96V90M2 64L8 57H92L98 64M37 57V47H63V57M33 47L39 41H61L67 47M37 41L42 35H58L63 41M41 35L45.5 30H54.5L59 35M50 30V7"/>
    <circle cx="50" cy="26.5" r="1.7"/><circle cx="50" cy="22" r="1.7"/><circle cx="50" cy="17.5" r="1.7"/><circle cx="50" cy="13" r="1.7"/><circle cx="50" cy="8.8" r="1.4"/>
    <path d="M45.5 90V80a4.5 4.5 0 0 1 9 0V90${arches(9, 87, 8, 69, 4, 9, [[40, 56]])}"/>`,
  // Jawa Tengah: Lawang Sewu
  jateng: `<path d="M4 90V58H96V90M2 58L9 51H91L98 58M22 58V33H35V58M65 58V33H78V58M20.5 33Q28.5 15 36.5 33M63.5 33Q71.5 15 79.5 33M28.5 23V16M71.5 23V16M22 42H35M65 42H78"/>
    <path d="${arches(7, 90, 7, 66, 4, 11, [[19, 36], [62, 79]])}${arches(26, 31, 5, 46, 3, 7)}${arches(69, 74, 5, 46, 3, 7)}"/>`,
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
};

export const provArt = (id) => (PROV_ART[id]
  ? `<svg class="prov-art" viewBox="0 0 100 100" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${PROV_ART[id]}</svg>`
  : '');
