// Akses data & utilitas bersama
import { ENTRIES } from './catalog.js';
import { ic } from './icons.js';

export const S = { data: null, butir: {}, prov: {}, provList: [] };

// Tahun anggaran yang bisa dipilih. Kode butir (L1-25 dst.) memakai penomoran 2027 untuk kedua tahun;
// nomor asli di dokumen tiap tahun tersimpan di butir.lamp/butir.no.
export const YEARS = {
  2027: {
    y: 2027, data: 'data/sbm.json', doc: 'docs/kmk-296-2026.pdf', src: 'KMK 296/2026', srcKind: 'KMK',
    norm: 'PMK 54/2026', normDoc: 'docs/pmk-54-2026.pdf', sources: 'PMK 54/2026 · KMK 296/2026', rows: '3.168', tolL1: 5,
  },
  2026: {
    y: 2026, data: 'data/sbm-2026.json', doc: 'docs/pmk-32-2025.pdf', src: 'PMK 32/2025', srcKind: 'PMK',
    norm: 'PMK 32/2025', normDoc: 'docs/pmk-32-2025.pdf', sources: 'PMK 32/2025', rows: '3.171', tolL1: 6,
  },
};
export const DEFAULT_YEAR = 2027;
export const Y = { ...YEARS[DEFAULT_YEAR] };

// Urutan: ?tahun= di URL, lalu pilihan terakhir, lalu bawaan
export function pickYear() {
  let y = null;
  try { y = Number(new URLSearchParams(location.search).get('tahun')) || null; } catch { /* abaikan */ }
  if (!YEARS[y]) y = store.get('year', DEFAULT_YEAR);
  if (!YEARS[y]) y = DEFAULT_YEAR;
  store.set('year', y);
  return y;
}
export function yearUrl(y, hash = location.hash) {
  return location.pathname + (y === DEFAULT_YEAR ? '' : `?tahun=${y}`) + hash;
}
export function switchYear(y) {
  if (!YEARS[y] || y === Y.y) return;
  store.set('year', y);
  location.href = yearUrl(y);
}

let yearReady = false;
export function initYear() {
  if (yearReady) return Y.y;
  yearReady = true;
  const y = pickYear();
  Object.assign(Y, YEARS[y]);
  // URL selalu memuat tahun non-bawaan, agar tautan yang dibagikan membuka tahun yang sama
  try { if (location.search !== (y === DEFAULT_YEAR ? '' : `?tahun=${y}`)) history.replaceState(null, '', yearUrl(y)); } catch { /* abaikan */ }
  document.documentElement.dataset.year = y;
  return y;
}

export async function loadData() {
  initYear();
  const url = Y.data;
  const res = await fetch(url, { cache: 'no-cache' }).catch(() => fetch(url));
  const d = await res.json();
  S.data = d;
  for (const b of d.butir) S.butir[b.id] = b;
  S.provList = d.provinsi;
  for (const p of d.provinsi) S.prov[p.id] = p;
  return d;
}

export const entry = (key) => ENTRIES.find((e) => e.key === key);
export const entriesOf = (butirId) => ENTRIES.filter((e) => e.butir === butirId);

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function ref(b, opt = {}) {
  const lamp = b.lamp === 1 ? 'Lampiran I' : 'Lampiran II';
  const code = opt.code || String(b.no);
  return `${Y.src} ${lamp} angka ${code}`;
}
export const lampShort = (b) => (b.lamp === 1 ? 'Lamp. I' : 'Lamp. II') + ' angka ' + b.no;

export function fmt(n, cur) {
  if (n == null) return '';
  if (cur === 'USD') return 'US$' + n.toLocaleString('en-US');
  return 'Rp' + n.toLocaleString('id-ID');
}

// Kolom nilai = kolom yang berisi angka
export function valueCols(t) {
  const set = new Set();
  for (const r of t.rows) if (r.n) r.n.forEach((x, i) => { if (x != null) set.add(i); });
  return [...set].sort((a, b) => a - b);
}

// Satuan seragam satu tabel (untuk disembunyikan dari kolom)
export function unitCol(t) {
  const i = t.cols.findIndex((c) => /^satuan$/i.test(c));
  if (i < 0) return null;
  const units = new Set(t.rows.filter((r) => r.v).map((r) => r.v[i]));
  return units.size === 1 ? { i, unit: [...units][0] } : { i, unit: null };
}

const SHORT = [
  [/^Memiliki Sampai Dengan 40 Pegawai: Satuan$/i, 'Satuan (≤ 40 pegawai)'],
  [/^Memiliki Sampai Dengan 40 Pegawai: Besaran$/i, 'Sampai 40 pegawai'],
  [/^Memiliki lebih dari 40 Pegawai: Satuan$/i, 'Satuan (> 40 pegawai)'],
  [/^Memiliki lebih dari 40 Pegawai: Besaran$/i, 'Lebih dari 40 pegawai'],
  [/^Pejabat Negara\/Wakil Menteri\/Pejabat Eselon I$/i, 'Pejabat Negara/Wamen/Eselon I'],
  [/^Pejabat Negara Lainnya\/Pejabat Eselon II$/i, 'Pejabat Negara Lainnya/Eselon II'],
  [/^Pejabat Eselon III\/Golongan IV$/i, 'Eselon III/Gol. IV'],
  [/^Pejabat Eselon IV\/Golongan III\/II\/I$/i, 'Eselon IV/Gol. III, II, I'],
  [/^Dalam Kota lebih dari 8 \(Delapan\) Jam$/i, 'Dalam Kota >8 Jam'],
];
export function shortCol(c) {
  for (const [re, s] of SHORT) if (re.test(c)) return s;
  return c;
}

export const UNIT = {
  OH: 'Orang/Hari', OB: 'Orang/Bulan', OJ: 'Orang/Jam', OP: 'Orang/Paket', OK: 'Orang/Kegiatan', OT: 'Orang/Tahun',
};

// Baris per provinsi untuk suatu tabel
export function rowsOfProv(butirId, tableIdx, pid) {
  const b = S.butir[butirId];
  const t = b && b.tables[tableIdx];
  if (!t) return [];
  return t.rows.filter((r) => r.v && r.p === pid);
}

// Baris data paket rapat dipisah per tingkat (group 29.1.x)
export function rapatTiers() {
  const t = S.butir['L1-29'].tables[0];
  const tiers = [];
  let cur = null;
  for (const r of t.rows) {
    if (r.g && r.c.split('.').length === 3) { cur = { code: r.c, name: r.g, rows: [] }; tiers.push(cur); }
    else if (r.v && cur) cur.rows.push(r);
  }
  return tiers;
}

export function pdfLink(b, page) {
  const p = page || b.pages[0];
  return `${Y.doc}#page=${p}`;
}

// Penyimpanan lokal (aman bila diblokir)
export const store = {
  get(k, d) { try { const v = localStorage.getItem('sbm27:' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('sbm27:' + k, JSON.stringify(v)); } catch { /* abaikan */ } },
};

// Keterangan kecil: ikon (i), muncul saat hover (PC) atau diketuk (HP)
export function tip(html, label = 'Keterangan') {
  if (!html) return '';
  return `<span class="tip"><button type="button" class="tip-btn" aria-label="${label}">${ic('info')}</button><span class="tip-body" role="tooltip">${html}</span></span>`;
}
// Menu lipat untuk teks penjelasan
export function fold(title, body, opt = {}) {
  return `<details class="fold"${opt.id ? ` id="${opt.id}"` : ''}${opt.open ? ' open' : ''}><summary><span>${title}</span>${opt.meta ? `<small>${opt.meta}</small>` : ''}</summary><div class="fold-body">${body}</div></details>`;
}
