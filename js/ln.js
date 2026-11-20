// Perjadin luar negeri: pemetaan kota (tabel tiket, Lamp. II) ke negara (tabel uang harian, Lamp. I).
// Tabel SBM tidak mencantumkan negara untuk tiap kota tiket; pemetaan ini dibuat manual dan bisa diganti pengguna.
import { S, norm } from './store.js';

const MAP = {
  'Amerika Serikat': ['Washington', 'Chicago', 'Houston', 'Los Angeles', 'New York', 'San Fransisco'],
  Kanada: ['Ottawa', 'Toronto', 'Vancouver'],
  Kolombia: ['Bogota'], Brasil: ['Brasilia'], Argentina: ['Boenos Aires'], Venezuela: ['Caracas'], Suriname: ['Paramaribo'],
  Chili: ['Santiago de Chile'], Ekuador: ['Quito'], Peru: ['Lima'], Meksiko: ['Meksiko'], Kuba: ['Havana'], Panama: ['Panama'],
  Austria: ['Vienna'], Belgia: ['Brussel'], Perancis: ['Paris', 'Marseille'], Jerman: ['Berlin', 'Bonn', 'Hamburg', 'Frankfurt'],
  Swiss: ['Bern', 'Geneva'], Belanda: ['Den Haag', 'Amsterdam'], Denmark: ['Kopenhagen'], Finlandia: ['Helsinki'], Swedia: ['Stockholm'],
  Inggris: ['London'], Norwegia: ['Oslo'], 'Bosnia dan Herzegovina': ['Sarajevo'], Kroasia: ['Zagreb'], Yunani: ['Athens'],
  Portugal: ['Lisbon'], Spanyol: ['Madrid'], Italia: ['Roma', 'Vatikan'], Serbia: ['Beograd'], Slovakia: ['Bratislava'], Rumania: ['Bucharest'],
  Ukraina: ['Kiev'], Rusia: ['Moskow'], Ceko: ['Praha'], Bulgaria: ['Sofia'], Polandia: ['Warsawa'], Hongaria: ['Budapest'],
  Senegal: ['Dakkar'], Nigeria: ['Abuja'], Kamerun: ['Yaounde'], Etiopia: ['Addis Ababa'], Kenya: ['Nairobi'], Madagaskar: ['Antananarivo'],
  Tanzania: ['Dar Es Salaam'], Zimbabwe: ['Harare'], Namibia: ['Windhoek'], 'Afrika Selatan': ['Pretoria', 'Cape Town', 'Johannesburg'],
  Mozambik: ['Maputo'], Aljazair: ['Algiers'], Mesir: ['Kairo'], Sudan: ['Khartoum'], Maroko: ['Rabbat'], Libya: ['Tripoli'], Tunisia: ['Tunisia'],
  Bahrain: ['Manama'], Irak: ['Baghdad'], Yordania: ['Amman'], Kuwait: ['Kuwait'], Libanon: ['Beirut'], Qatar: ['Doha'], Suriah: ['Damaskus'],
  Turki: ['Ankara', 'Istanbul'], 'Uni Emirat Arab': ['Abu Dhabi', 'Dubai'], Yaman: ['Sanaa'], 'Saudi Arabia': ['Riyadh', 'Jeddah'],
  'Kesultanan Oman': ['Muscat'], Uzbekistan: ['Tashkent'], Kazakhstan: ['Astana'], Azerbaijan: ['Baku'],
  'Republik Rakyat Tiongkok': ['Beijing', 'Shanghai', 'Guangzhou'], Hongkong: ['Hongkong'], Jepang: ['Tokyo', 'Osaka'], 'Korea Utara': ['Pyongyang'],
  'Korea Selatan': ['Seoul'], Afganistan: ['Kabul'], Iran: ['Teheran'], Srilanka: ['Kolombo'], Bangladesh: ['Dhaka'], Pakistan: ['Islamabad', 'Karachi'],
  India: ['New Delhi', 'Mumbai'], 'Brunei Darussalam': ['Bandar Seri Bagawan'], Thailand: ['Bangkok', 'Songkhla'], Filipina: ['Manila', 'Davao City'],
  'Timor Leste': ['Dilli'], Vietnam: ['Hanoi', 'Ho Chi Minh'], Malaysia: ['Kuala Lumpur', 'Johor Bahru', 'Kota Kinabalu', 'Kuching', 'Penang', 'Tawau'],
  Kamboja: ['Phnom Penh'], Singapura: ['Singapura'], Laos: ['Vientiane'], Myanmar: ['Yangon'],
  Australia: ['Canberra', 'Darwin', 'Melbourne', 'Perth', 'Sydney'], 'Kaledonia Baru': ['Noumea'], 'Papua Nugini': ['Port Moresby', 'Vanimo'],
  Fiji: ['Suva'], 'Selandia Baru': ['Wellington'],
};
const CITY_NEG = {};
for (const [neg, cities] of Object.entries(MAP)) for (const c of cities) CITY_NEG[c] = neg;

// Golongan uang harian luar negeri per tingkat pelaksana (Pelaksana = Gol. D)
export const GOL = { pn: 'A', e1: 'B', pnl: 'B', e2: 'C', e3: 'D', e4: 'D' };
export const KELAS_LN = [['eks', 'Eksekutif'], ['bis', 'Bisnis'], ['eko', 'Ekonomi']];

export const tiketTable = () => S.butir['L2-7'].tables[0];
export const uhTable = () => S.butir['L1-26'].tables[0];
export const cityRow = (city) => tiketTable().rows.find((r) => r.v && r.v[1] === city) || null;
export const negRow = (neg) => uhTable().rows.find((r) => r.v && r.v[1] === neg) || null;
export const negOfCity = (city) => CITY_NEG[city] || null;
// Kota tiket bawaan untuk negara: urutan pertama di MAP (ibu kota/perwakilan utama), bila ada di tabel
export const cityOfNeg = (neg) => (MAP[neg] || []).find((c) => cityRow(c)) || null;
export const negList = () => uhTable().rows.filter((r) => r.v).map((r) => r.v[1]);

let LIST = null;
function build() {
  const L = [];
  let g = null;
  for (const r of tiketTable().rows) {
    if (r.g) { g = r.g; continue; }
    const c = r.v[1];
    const neg = negOfCity(c);
    L.push({ id: 'c:' + c, kind: 'kota', n: c, sub: `${neg || 'Negara belum dipetakan'} · ${g}`, t: 'Kota', s: norm(`${c} ${neg || ''}`) });
  }
  for (const n of negList()) {
    const c = cityOfNeg(n);
    L.push({ id: 'n:' + n, kind: 'negara', n, sub: c ? `Negara · tiket ke ${c}` : 'Negara · tiket tidak tercantum', t: 'Negara', s: norm(n) });
  }
  LIST = L;
}
export function lnSuggest(q, limit = 8) {
  if (!LIST) build();
  const n = norm(q);
  if (!n) return [];
  const toks = n.split(' ');
  const out = [];
  for (const it of LIST) {
    const words = it.s.split(' ');
    if (!toks.every((t) => words.some((w) => w.startsWith(t)))) continue;
    const nameN = norm(it.n);
    out.push({ it, score: (nameN === n ? -10 : nameN.startsWith(n) ? -5 : 0) + (it.kind === 'negara' ? 0.5 : 0) });
  }
  out.sort((a, b) => a.score - b.score || a.it.n.localeCompare(b.it.n, 'id'));
  return out.slice(0, limit).map((x) => x.it);
}
// Reset daftar saat ganti tahun anggaran
export function resetLn() { LIST = null; }
