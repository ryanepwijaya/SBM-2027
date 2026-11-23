// Hitung Perjalanan: perkiraan biaya perjalanan dinas (dalam negeri luar kota, dalam kota, luar negeri).
// Menampilkan angka SBM yang relevan dikali volume. Ketentuan PMK Perjalanan Dinas (PMK 113/PMK.05/2012 s.t.d.d.
// PMK 119/2023) hanya dipakai bila berupa rumus atas angka SBM yang tertulis di pasal/lampirannya, dengan rujukan pasal.
import { S, Y, esc, fmt, valueCols, money, effVal, effPct, pctTxt, fold, tip, rapatTiers, effMini, tableKey, pdRef, pdTxt } from './store.js';
import { W, resolve, computeRoute, rowBy, capName } from './rute.js';
import { GOL, KELAS_LN, tiketTable, uhTable, cityRow, negRow, negList } from './ln.js';
import { ic } from './icons.js';

// Tingkat pelaksana mengikuti kolom tabel penginapan; rep = baris tabel uang representasi
export const TINGKAT = [
  { k: 'pn', n: 'Pejabat Negara/Wakil Menteri', s: 'Pejabat Negara/Wamen', h: 0, rep: 0 },
  { k: 'e1', n: 'Pejabat Eselon I', s: 'Eselon I', h: 0, rep: 1 },
  { k: 'pnl', n: 'Pejabat Negara Lainnya', s: 'Pejabat Negara Lainnya', h: 1, rep: null },
  { k: 'e2', n: 'Pejabat Eselon II', s: 'Eselon II', h: 1, rep: 2 },
  { k: 'e3', n: 'Pejabat Eselon III/Golongan IV', s: 'Eselon III/Gol. IV', h: 2, rep: null },
  { k: 'e4', n: 'Pejabat Eselon IV/Golongan III/II/I', s: 'Eselon IV/Gol. III, II, I', h: 3, rep: null },
];

// Tingkat → kelompok tarif paket rapat (L1-29): 0 Menteri/Wamen, 1 Eselon I dan II/JF Utama, 2 Eselon III ke bawah
// Kelas pesawat per tingkat sesuai Lampiran IV PMK 113/PMK.05/2012: Tingkat A (Pejabat Negara setingkat menteri, Eselon I) Bisnis;
// Tingkat B (Pejabat Negara Lainnya, Eselon II) dan Tingkat C (Eselon III ke bawah) Ekonomi. Berlaku juga untuk keluarga (dinas pindah).
export const KELAS_IV = { pn: 'bis', e1: 'bis', pnl: 'eko', e2: 'eko', e3: 'eko', e4: 'eko' };
export const kelasNm = (k) => (k === 'bis' ? 'Bisnis' : 'Ekonomi');
// Tingkat A berhak Bisnis tetapi boleh memakai Ekonomi; tingkat lain dikunci Ekonomi
export const TIER_A = ['pn', 'e1'];
export const kelasOf = (pick = {}) => Object.fromEntries(Object.entries(KELAS_IV).map(([k, v]) => [k, TIER_A.includes(k) && pick[k] === 'eko' ? 'eko' : v]));
// Sel kelas pesawat: pilihan untuk Tingkat A, terkunci untuk lainnya. attr = nama data-atribut untuk pilihan.
export const kelasCellIV = (t, pick = {}, attr = 'kelasa') => (TIER_A.includes(t.k)
  ? `<select class="sel kp-kelas" data-${attr}="${t.k}" aria-label="Kelas pesawat ${esc(t.n)}"><option value="bis"${pick[t.k] !== 'eko' ? ' selected' : ''}>Bisnis</option><option value="eko"${pick[t.k] === 'eko' ? ' selected' : ''}>Ekonomi</option></select>`
  : `<span class="kp-kc eko" title="Dikunci sesuai Lampiran IV">${ic('lock')}Ekonomi</span>`);

// Alur dua halaman: 1 isi data, 2 estimasi biaya (estimasi baru tampil setelah semua isian lengkap)
export function wizHead(step, sub1, sub2, t2 = 'Estimasi biaya') {
  return `<nav class="ms-steps wz-steps" aria-label="Langkah">
    <button type="button" class="ms-st${step === 1 ? ' on' : ''}" data-wz="1"${step === 1 ? ' aria-current="step"' : ''}><span class="step">1</span><span class="ms-st-tx"><b>Isi data</b><small class="wz-s1">${esc(sub1)}</small></span></button>
    <button type="button" class="ms-st${step === 2 ? ' on' : ''}" data-wz="2"${step === 2 ? ' aria-current="step"' : ''}><span class="step">2</span><span class="ms-st-tx"><b>${esc(t2)}</b><small class="wz-s2">${esc(sub2)}</small></span></button>
  </nav>`;
}
// Versi banyak langkah: steps = [[judul, keterangan], ...]
export function wizHeadN(step, steps) {
  return `<nav class="ms-steps wz-steps n${steps.length}" aria-label="Langkah">${steps.map(([t, sub], i) => `<button type="button" class="ms-st${step === i + 1 ? ' on' : ''}" data-wz="${i + 1}"${step === i + 1 ? ' aria-current="step"' : ''}><span class="step">${i + 1}</span><span class="ms-st-tx"><b>${esc(t)}</b><small class="wz-s${i + 1}">${esc(sub)}</small></span></button>`).join('')}</nav>`;
}
export const wizBar = (label = 'Cek estimasi') => `<div class="card card-pad wz-bar"><div class="wz-miss small" aria-live="polite"></div><button type="button" class="btn primary" data-wz="2">${esc(label)} ${ic('chevron-right')}</button></div>`;
// Perbarui daftar isian yang belum lengkap dan tombol Cek estimasi
export function wizUpdate(root, missing) {
  const m = root.querySelector('.wz-miss');
  if (m) m.innerHTML = missing.length ? `${ic('info')}<span>Lengkapi dulu: ${missing.map((x) => `<b>${esc(x)}</b>`).join(', ')}.</span>` : `${ic('check')}<span>Semua isian lengkap.</span>`;
  root.querySelectorAll('button[data-wz="2"]').forEach((b) => { b.disabled = !!missing.length; });
  root.classList.toggle('wz-ok', !missing.length);
}
export function wizGo(root, step) {
  root.dataset.wz = String(step);
  root.querySelectorAll('.wz-steps .ms-st').forEach((b) => { const on = b.dataset.wz === String(step); b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
// Form selebar halaman: langkah dibagi ke dua kolom di layar lebar (paruh pertama kiri, sisanya kanan)
export function wizCols(form) {
  if (!form || form.querySelector(':scope > .kp-col')) return;
  const steps = [...form.querySelectorAll(':scope > .kp-step')];
  const n = Math.ceil(steps.length / 2);
  const a = document.createElement('div'), b = document.createElement('div');
  a.className = 'kp-col'; b.className = 'kp-col';
  steps.slice(0, n).forEach((x) => a.appendChild(x));
  steps.slice(n).forEach((x) => b.appendChild(x));
  form.append(a); if (b.children.length) form.append(b);
  form.classList.add('kp-2c');
}
export const editBtn = () => `<button type="button" class="btn" data-wz="1">${ic('pencil-line')} Ubah isian</button>`;
// Cara bayar komponen menurut PMK Perjalanan Dinas: L = lumpsum, R = biaya riil
export const BYR = { L: 'Lumpsum', R: 'Biaya riil' };

export const FB_TIER = { pn: 0, e1: 1, pnl: 1, e2: 1, e3: 2, e4: 2 };
const FB_TIER_N = ['Menteri/Wamen', 'Eselon I dan II/JF Utama', 'Eselon III/JF Madya ke bawah'];

// Isian bertahan selama aplikasi terbuka (tidak disimpan ke perangkat)
export const KP = {
  lingkup: 'dn', dari: 'jakarta', ke: '', jenis: 'lk', hari: 1, malam: 1, malamManual: false, delapan: true,
  inap: 'hotel', sah: false, sahId: '', sahArah: 'both', layanan: '', kelasA: {}, wz: 1,
  lnAsal: 'jakarta', lnKota: '', lnNeg: '', kurs: 0,
  org: { pn: 0, e1: 0, pnl: 0, e2: 0, e3: 0, e4: 1 },
  kelasLn: { pn: 'eko', e1: 'eko', pnl: 'eko', e2: 'eko', e3: 'eko', e4: 'eko' },
};

export const refOf = (bid, ti, code) => {
  const b = S.butir[bid];
  const r = code ? rowBy(bid, code, ti) : null;
  const num = r?.v?.[0];
  return { label: `${b.lamp === 1 ? 'Lamp. I' : 'Lamp. II'} angka ${num && /^\d/.test(num) ? num : b.no}`, href: `#/b/${bid}?t=${ti}${code ? '&r=' + encodeURIComponent(code) : ''}` };
};
export const plain = (s) => String(s).replace(/⇄/g, '–').replace(/→/g, '–');

export const peopleOf = (state) => TINGKAT.filter((t) => state.org[t.k] > 0).map((t) => ({ ...t, c: state.org[t.k] }));
export const adder = (lines) => (x) => {
  const t = S.butir[x.bid].tables[x.ti];
  const cur = t.cur || 'IDR';
  const unit = x.n != null ? effVal(t, x.n, cur) : null;
  lines.push({ ...x, t, cur, unit, amount: unit != null ? (cur === 'USD' ? unit * x.qty : Math.round(unit * x.qty)) : null, sifat: S.butir[x.bid].sifat, ref: refOf(x.bid, x.ti, x.code) });
};
// Baris isian pengguna (bukan angka SBM), mis. biaya layanan: tanpa tabel dan rujukan SBM
export const manualLine = (lines, x) => lines.push({ cur: 'IDR', unit: x.amount, n: x.amount, qty: 1, manual: true, t: null, sifat: null, ref: null, ...x });
// Penjumlahan per mata uang, per orang, dan total Rupiah (USD dikonversi bila kurs diisi)
export function finish(o, lines, people, kurs = 0) {
  const tot = {};
  for (const l of lines) if (l.amount != null) tot[l.cur] = (tot[l.cur] || 0) + l.amount;
  const perPerson = people.map((p) => {
    const sums = {};
    for (const l of lines) {
      if (l.unit == null || l.manual) continue;
      const q = l.perAll ? l.perAll : l.per === p.k ? (l.perQty || 1) : 0;
      if (q) sums[l.cur] = (sums[l.cur] || 0) + l.unit * q;
    }
    return { ...p, sum: sums.IDR || 0, sums };
  });
  const hasUsd = lines.some((l) => l.cur === 'USD');
  const k = kurs > 0 ? kurs : 0;
  const grand = Math.round((tot.IDR || 0) + (k ? (tot.USD || 0) * k : 0));
  return { ...o, ready: true, lines, people, total: people.reduce((a, t) => a + t.c, 0), perPerson, tot, grand, hasUsd, kurs: k, effOn: lines.some((l) => l.t && effPct(l.t) < 100), missing: lines.filter((l) => l.missing) };
}

// Hitung semua baris biaya sesuai lingkup perjalanan
export function compute(state = KP) {
  if (state.lingkup === 'dk') return computeDK(state);
  if (state.lingkup === 'ln') return computeLN(state);
  return computeDN(state);
}

// Transportasi sekali jalan A → B (taksi di kota keberangkatan dan kedatangan 1 kali, transport darat 1 kali,
// tiket ½ tarif PP SBM). Dipakai untuk membandingkan estimasi dari Tempat Sah dengan Tempat Kedudukan.
export function oneWay(A, B, people, kel = KELAS_IV) {
  const total = people.reduce((a, t) => a + t.c, 0);
  const r = computeRoute(A, B);
  if (r.sameKab) return { sum: 0, miss: false };
  let sum = 0, hasT = false, miss = false;
  for (const sec of r.sec.filter((s) => ['Keberangkatan', 'Perjalanan', 'Kedatangan'].includes(s.h))) {
    for (const it of sec.items) {
      const row = it.code ? rowBy(it.bid, it.code, it.ti) : null;
      const t = S.butir[it.bid].tables[it.ti];
      if (!row) { miss = true; continue; }
      if (it.bid === 'L2-6') { if (hasT) continue; hasT = true; for (const p of people) sum += Math.round(effVal(t, row.n[kel[p.k] === 'bis' ? 3 : 4]) * p.c * 0.5); }
      else if (it.bid === 'L2-5') sum += Math.round(effVal(t, row.n[3]) * total);
      else if (it.bid === 'L2-2' || it.bid === 'L2-3') sum += Math.round(effVal(t, row.n[4]) * total);
    }
  }
  return { sum, miss };
}

// Dalam negeri, luar kota
function computeDN(state) {
  const O = resolve(state.dari), D = state.ke ? resolve(state.ke) : null;
  if (!O || !D) return { ready: false };
  const people = peopleOf(state);
  const total = people.reduce((a, t) => a + t.c, 0);
  const r = computeRoute(O, D);
  if (r.sameKab) return { ready: true, O, D, r, dalamKota: true };
  // Kelas pesawat: Lampiran IV (bawaan); luar negeri mengirim kelas sendiri untuk ruas ke Jakarta
  const kel = state.kelas || kelasOf(state.kelasA);
  const lines = [];
  const add = adder(lines);
  let hasTiket = false;
  const alt = [];
  // Transportasi dari mesin Rute (taksi, tiket, transport darat, Bodetabek)
  for (const sec of r.sec.filter((s) => ['Keberangkatan', 'Perjalanan', 'Kedatangan'].includes(s.h))) {
    for (const it of sec.items) {
      const row = it.code ? rowBy(it.bid, it.code, it.ti) : null;
      const base = { g: 'Transportasi', sec: sec.h, cat: it.bid === 'L2-6' ? 'tiket' : it.bid === 'L2-5' ? 'taksi' : 'darat', bid: it.bid, ti: it.ti, code: it.code, label: plain(it.title), byr: 'R' };
      if (!row) { add({ ...base, n: null, qty: 0, vol: 'Tidak tercantum di tabel; mengacu harga riil/pasar', missing: true }); continue; }
      if (it.bid === 'L2-6') {
        if (hasTiket) { alt.push(plain(it.title)); continue; }
        hasTiket = true;
        for (const p of people) {
          const bis = kel[p.k] === 'bis';
          add({ ...base, label: `${plain(it.title)} · ${bis ? 'Bisnis' : 'Ekonomi'}`, sub: p.n, n: row.n[bis ? 3 : 4], qty: p.c, vol: `${p.c} orang`, per: p.k });
        }
      } else if (it.bid === 'L2-5') {
        add({ ...base, n: row.n[3], qty: 2 * total, vol: `2 kali × ${total} orang`, perAll: 2 });
      } else if (it.bid === 'L2-2' || it.bid === 'L2-3') {
        add({ ...base, n: row.n[4], qty: 2 * total, vol: `2 kali (PP) × ${total} orang`, perAll: 2 });
      }
    }
  }
  // Biaya layanan dan sejenisnya (isian pengguna, bukan angka SBM)
  const lay = Math.round(Number(String(state.layanan || '').replace(/\D/g, '')) || 0);
  if (lay > 0) manualLine(lines, { g: 'Transportasi', cat: 'layanan', label: 'Biaya layanan, bagasi, dan sejenisnya', sub: 'Isian pengguna, bukan angka SBM', amount: lay, vol: 'Sesuai isian', byr: 'R', pd: 'layanan' });
  // Selama di tujuan
  // Mode paket rapat fullboard (dipakai Kalkulator massal): hari paket memakai tarif paket + uang harian fullboard,
  // sisa hari memakai uang harian biasa, malam di luar hari paket memakai penginapan.
  const fb = state.mode === 'fb' ? Math.max(0, Math.min(state.paket || 0, state.hari)) : 0;
  const uhDays = state.hari - fb;
  const nights = Math.max(0, state.malam - fb);
  const pName = S.prov[D.prov].nama;
  const tUH = S.butir['L1-25'].tables[0];
  const rUH = tUH.rows.find((x) => x.p === D.prov);
  const vUH = valueCols(tUH);
  const uhCol = state.jenis === 'diklat' ? vUH[2] : vUH[0];
  if (uhDays > 0) add({ g: 'Selama di tujuan', cat: 'uh', bid: 'L1-25', ti: 0, code: rUH?.c, label: `Uang harian · ${pName}${state.jenis === 'diklat' ? ' (diklat)' : ''}`, n: rUH ? rUH.n[uhCol] : null, qty: uhDays * total, vol: `${uhDays} hari × ${total} orang`, perAll: uhDays, missing: !rUH, byr: 'L' });
  if (fb > 0) {
    const tP = S.butir['L1-29'].tables[0];
    const fbCol = tP.cols.findIndex((c) => /fullboard/i.test(c));
    const tiers = rapatTiers();
    for (const p of people) {
      const tier = tiers[FB_TIER[p.k]];
      const row = tier?.rows.find((x) => x.p === D.prov);
      add({ g: 'Selama di tujuan', cat: 'fb', bid: 'L1-29', ti: 0, code: row?.c, label: `Paket rapat fullboard · ${pName}`, sub: `${p.n} · tarif ${FB_TIER_N[FB_TIER[p.k]]}`, n: row ? row.n[fbCol] : null, qty: fb * p.c, vol: `${fb} paket × ${p.c} orang`, per: p.k, perQty: fb, missing: !row });
    }
    const tU = S.butir['L1-29'].tables[1];
    const rU = tU.rows.find((x) => x.v && /fullboard/i.test(x.v[1]));
    add({ g: 'Selama di tujuan', cat: 'uhfb', bid: 'L1-29', ti: 1, code: rU?.c, label: 'Uang harian rapat fullboard', n: rU ? rU.n[3] : null, qty: fb * total, vol: `${fb} hari × ${total} orang`, perAll: fb, missing: !rU, byr: 'L' });
  }
  const tH = S.butir['L1-27'].tables[0];
  const rH = tH.rows.find((x) => x.p === D.prov);
  const vH = valueCols(tH);
  // Tidak menginap di hotel/tempat menginap: 30% tarif hotel, lumpsum (Pasal 8 ayat (5))
  const non = state.inap === 'non';
  if (nights > 0) {
    for (const p of people) add({ g: 'Selama di tujuan', cat: 'inap', bid: 'L1-27', ti: 0, code: rH?.c, label: non ? `Penginapan, tidak menginap di hotel · ${pName}` : `Penginapan · ${pName}`, sub: p.n, n: rH ? rH.n[vH[p.h]] : null, qty: nights * p.c * (non ? 0.3 : 1), vol: `${non ? '30% × ' : ''}${nights} malam × ${p.c} orang`, per: p.k, perQty: nights * (non ? 0.3 : 1), missing: !rH, byr: non ? 'L' : 'R', pd: non ? 'inap30' : null });
  }
  const tRep = S.butir['L1-25'].tables[1];
  const repRows = tRep.rows.filter((x) => x.v);
  for (const p of people.filter((x) => x.rep != null)) {
    const rr = repRows[p.rep];
    if (rr) add({ g: 'Selama di tujuan', cat: 'rep', bid: 'L1-25', ti: 1, code: rr.c, label: 'Uang representasi', sub: p.n, n: rr.n[valueCols(tRep)[0]], qty: state.hari * p.c, vol: `${state.hari} hari × ${p.c} orang`, per: p.k, perQty: state.hari, byr: 'L' });
  }
  // Tempat Sah (Pasal 8 ayat (3b)): dibayar riil, paling banyak sebesar estimasi dari Tempat Kedudukan
  let sah = null;
  const SA = state.sah && state.sahId ? resolve(state.sahId) : null;
  if (SA && !state.kelas) {
    const go = state.sahArah !== 'back', back = state.sahArah !== 'go';
    const a1 = oneWay(go ? SA : O, D, people, kel), a2 = oneWay(D, back ? SA : O, people, kel);
    const batas = lines.filter((l) => l.g === 'Transportasi' && !l.manual && l.amount != null).reduce((a, l) => a + l.amount, 0);
    sah = { SA, go, back, est: a1.sum + a2.sum, batas, miss: a1.miss || a2.miss };
  }
  return finish({ lingkup: 'dn', O, D, r, alt, hasTiket, sah, non }, lines, people);
}

// Dalam kota: uang harian dan representasi dalam kota (bila lebih dari 8 jam) + transpor kegiatan PP
function computeDK(state) {
  const D = state.ke ? resolve(state.ke) : null;
  if (!D) return { ready: false };
  const people = peopleOf(state);
  const total = people.reduce((a, t) => a + t.c, 0);
  const lines = [];
  const add = adder(lines);
  const h = state.hari;
  const tT = S.butir['L2-4'].tables[0];
  const rT = tT.rows.find((x) => x.v);
  add({ g: 'Transportasi', cat: 'darat', bid: 'L2-4', ti: 0, code: rT?.c, label: 'Transpor kegiatan dalam kabupaten/kota (PP)', n: rT ? rT.n[valueCols(tT)[0]] : null, qty: h * total, vol: `${h} hari × ${total} orang`, perAll: h, missing: !rT, byr: 'L', pd: 'lamp3' });
  if (state.delapan !== false) {
    const pName = S.prov[D.prov].nama;
    const tUH = S.butir['L1-25'].tables[0];
    const rUH = tUH.rows.find((x) => x.p === D.prov);
    add({ g: 'Selama kegiatan', cat: 'uh', bid: 'L1-25', ti: 0, code: rUH?.c, label: `Uang harian dalam kota lebih dari 8 jam · ${pName}`, n: rUH ? rUH.n[valueCols(tUH)[1]] : null, qty: h * total, vol: `${h} hari × ${total} orang`, perAll: h, missing: !rUH, byr: 'L' });
    const tRep = S.butir['L1-25'].tables[1];
    const repRows = tRep.rows.filter((x) => x.v);
    for (const p of people.filter((x) => x.rep != null)) {
      const rr = repRows[p.rep];
      if (rr) add({ g: 'Selama kegiatan', cat: 'rep', bid: 'L1-25', ti: 1, code: rr.c, label: 'Uang representasi dalam kota', sub: p.n, n: rr.n[valueCols(tRep)[1]], qty: h * p.c, vol: `${h} hari × ${p.c} orang`, per: p.k, perQty: h, byr: 'L' });
    }
  }
  return finish({ lingkup: 'dk', O: D, D, alt: [], hasTiket: false }, lines, people);
}

// Luar negeri: dari ibu kota provinsi ke Jakarta (tiket/transport dalam negeri), tiket PP Jakarta–kota tujuan, uang harian per negara
export const lnCapitals = () => S.provList.map((p) => ({ id: p.id === 'dki' ? 'jakarta' : W.data.capital[p.id] || 'p-' + p.id, n: p.id === 'dki' ? 'Jakarta' : capName(p.id), prov: p.nama }));
function computeLN(state) {
  const O = resolve(state.lnAsal || 'jakarta');
  if (!O || (!state.lnKota && !state.lnNeg)) return { ready: false };
  const people = peopleOf(state);
  const total = people.reduce((a, t) => a + t.c, 0);
  const lines = [];
  const add = adder(lines);
  const h = state.hari;
  const alt = [];
  const G1 = 'Transportasi ke/dari Jakarta';
  if (O.dki) {
    const tT = S.butir['L2-5'].tables[0];
    const row = tT.rows.find((x) => x.p === 'dki');
    add({ g: G1, cat: 'taksi', bid: 'L2-5', ti: 0, code: row?.c, label: 'Taksi di kota asal · DKI Jakarta', n: row ? row.n[3] : null, qty: 2 * total, vol: `2 kali × ${total} orang`, perAll: 2, missing: !row });
  } else {
    const dnKelas = Object.fromEntries(TINGKAT.map((t) => [t.k, state.kelasLn[t.k] === 'eko' ? 'eko' : 'bis']));
    const dn = computeDN({ dari: O.id, ke: 'jakarta', jenis: 'lk', hari: 1, malam: 0, org: state.org, kelas: dnKelas });
    for (const l of dn.lines || []) if (l.g === 'Transportasi' && l.sec !== 'Kedatangan') lines.push({ ...l, g: G1, byr: null });
    alt.push(...(dn.alt || []));
  }
  const tL = tiketTable();
  const kcol = Object.fromEntries(KELAS_LN.map(([k, n]) => [k, tL.cols.findIndex((c) => c.toLowerCase().includes(n.toLowerCase()))]));
  const cr = state.lnKota ? cityRow(state.lnKota) : null;
  for (const p of people) {
    const kel = state.kelasLn[p.k] || 'eko';
    const nm = KELAS_LN.find((x) => x[0] === kel)[1];
    const n = cr ? cr.n[kcol[kel]] : null;
    add({ g: 'Tiket luar negeri', cat: 'tiketln', bid: 'L2-7', ti: 0, code: cr?.c, label: state.lnKota ? `Tiket pesawat Jakarta – ${state.lnKota} PP · ${nm}` : `Tiket pesawat ke ${state.lnNeg} · ${nm}`, sub: p.n, n, qty: p.c, vol: `${p.c} orang`, per: p.k, missing: n == null });
  }
  const tU = uhTable();
  const nr = state.lnNeg ? negRow(state.lnNeg) : null;
  for (const p of people) {
    const g = GOL[p.k];
    const col = tU.cols.findIndex((c) => c.replace(/\s/g, '') === 'Gol.' + g);
    add({ g: 'Selama di luar negeri', cat: 'uhln', bid: 'L1-26', ti: 0, code: nr?.c, label: `Uang harian · ${state.lnNeg || 'negara belum dipilih'}`, sub: `${p.n} · Gol. ${g}`, n: nr ? nr.n[col] : null, qty: h * p.c, vol: `${h} hari × ${p.c} orang`, per: p.k, perQty: h, missing: !nr });
  }
  return finish({ lingkup: 'ln', O, D: null, alt, hasTiket: true, city: state.lnKota, neg: state.lnNeg }, lines, people, state.kurs);
}

const stepper = (id, val, min, max, label) => `<div class="stp" data-stp="${id}" data-min="${min}" data-max="${max}"><button type="button" data-d="-1" aria-label="Kurangi ${esc(label)}"${val <= min ? ' disabled' : ''}>−</button><input class="stp-in" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" value="${val}" aria-label="Jumlah ${esc(label)}"><button type="button" data-d="1" aria-label="Tambah ${esc(label)}"${val >= max ? ' disabled' : ''}>+</button></div>`;
// Malam bawaan mengikuti hari: 1 hari 1 malam, selebihnya hari dikurangi satu
export const autoMalam = (h) => Math.max(1, h - 1);
export const KP_DEFAULT = JSON.parse(JSON.stringify(KP));
// Reset mengembalikan isian, tapi lingkup dan kurs tetap
export function resetKP() { const keep = { lingkup: KP.lingkup, kurs: KP.kurs }; Object.assign(KP, JSON.parse(JSON.stringify(KP_DEFAULT)), keep); }

const seg = (name, opts, cur) => `<div class="kp-seg" role="radiogroup">${opts.map((o) => `<button type="button" role="radio" aria-checked="${o.v === cur}" class="${o.v === cur ? 'on' : ''}" data-${name}="${o.v}"${o.soon ? ' disabled' : ''}>${esc(o.t)}${o.soon ? ' <em>Segera</em>' : ''}</button>`).join('')}</div>`;
export const kursTxt = (k) => (k ? k.toLocaleString('id-ID', { maximumFractionDigits: 2 }) : '');

// ui: { routeForm, placeField, placeLabel }
export function formHtml(ui) {
  const L = KP.lingkup;
  let tujuan = '';
  if (L === 'dn') {
    tujuan = `${ui.routeForm(KP.dari, KP.ke)}
      <div class="kp-row"><span class="kp-lbl">Uang harian</span>${seg('jenis', [{ v: 'lk', t: 'Luar kota' }, { v: 'diklat', t: 'Diklat' }], KP.jenis)}</div>`;
  } else if (L === 'dk') {
    tujuan = `<div class="route-form">${ui.placeField('rKe', 'Kabupaten/kota', KP.ke ? ui.placeLabel(KP.ke) : '', 'Ketik kabupaten/kota, mis. Kota Surabaya, Kab. Bogor…')}</div>
      <div class="kp-row"><span class="kp-lbl">Lebih dari 8 jam ${tip('Uang harian dan uang representasi dalam kota hanya tersedia untuk perjalanan dinas dalam kota lebih dari 8 jam. Bila Tidak, yang dihitung hanya transpor kegiatan.')}</span>${seg('delapan', [{ v: '1', t: 'Ya' }, { v: '0', t: 'Tidak' }], KP.delapan ? '1' : '0')}</div>`;
  } else {
    const negs = negList();
    tujuan = `<label class="kp-fld"><span>Dari (ibu kota provinsi)</span><select class="sel" id="lnAsal">${lnCapitals().map((c) => `<option value="${esc(c.id)}"${c.id === KP.lnAsal ? ' selected' : ''}>${esc(c.n)} · ${esc(c.prov)}</option>`).join('')}</select></label>
      <div class="route-form">${ui.placeField('lnQ', 'Ke (kota atau negara)', KP.lnKota || KP.lnNeg || '', 'Ketik kota atau negara, mis. Tokyo, Belanda…')}</div>
      <label class="kp-fld"><span>Negara untuk uang harian ${tip('Terisi otomatis dari kota tujuan (pemetaan dibuat aplikasi ini karena tabel tiket tidak mencantumkan negara). Bisa diganti.')}</span><select class="sel" id="lnNeg"><option value="">Pilih negara…</option>${negs.map((n) => `<option${n === KP.lnNeg ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <label class="kp-fld"><span>Kurs (Rp per US$) ${tip('Opsional. Angka SBM luar negeri dalam dolar AS. Isi kurs yang dipakai satker untuk melihat perkiraan total dalam Rupiah. Tersimpan di perangkat ini.')}</span><span class="kp-kurs"><b>Rp</b><input id="lnKurs" type="text" inputmode="decimal" autocomplete="off" placeholder="Kosongkan bila cukup US$" value="${esc(kursTxt(KP.kurs))}"></span></label>`;
  }
  const kelasCell = (t) => L === 'ln'
    ? `<select class="sel kp-kelas" data-kelasln="${t.k}" aria-label="Kelas tiket ${esc(t.n)}">${KELAS_LN.map(([k, n]) => `<option value="${k}"${KP.kelasLn[t.k] === k ? ' selected' : ''}>${n}</option>`).join('')}</select>`
    : kelasCellIV(t, KP.kelasA);
  const note = L === 'ln'
    ? 'Golongan uang harian: Pejabat Negara/Wamen A, Eselon I dan Pejabat Negara Lainnya B, Eselon II C, lainnya D.'
    : L === 'dk' ? ''
      : `Kelas pesawat sesuai ${pdRef('lamp4')}.`;
  const segP = (name, opts, cur) => `<div class="kp-seg" role="radiogroup">${opts.map(([v, t]) => `<button type="button" role="radio" aria-checked="${v === cur}" class="${v === cur ? 'on' : ''}" data-${name}="${v}">${esc(t)}</button>`).join('')}</div>`;
  const extra = L !== 'dn' ? '' : `<div class="kp-step"><h2 class="kp-h"><span class="step">4</span>Ketentuan tambahan <small class="muted">opsional</small></h2>
      <div class="kp-opt">
        <div class="kp-row"><span class="kp-lbl">Penginapan ${tip('Bila pelaksana tidak menginap di hotel atau tempat menginap lainnya, diberikan biaya penginapan 30% dari tarif hotel di kota tujuan, dibayar lumpsum (Pasal 8 ayat (5) PMK 113/PMK.05/2012).')}</span>${segP('inap', [['hotel', 'Di hotel'], ['non', 'Tidak di hotel (30%)']], KP.inap)}</div>
        <div class="kp-pd">${pdRef('inap30')}</div>
      </div>
      <div class="kp-opt">
        <label class="iv-lock"><input type="checkbox" id="kpSah"${KP.sah ? ' checked' : ''}><span>Berangkat atau pulang dari/ke Tempat Sah ${tip('Tempat Sah: lokasi pelaksana berada secara sah, misalnya lokasi fleksibilitas tempat bekerja, lokasi cuti, lokasi saat libur resmi, atau tempat tujuan penugasan perjalanan dinas lain. Transportasinya dibayar sesuai biaya riil, paling banyak sebesar estimasi dari Tempat Kedudukan ke Tempat Tujuan (Pasal 8 ayat (3b) PMK 113/PMK.05/2012 sebagaimana diubah PMK 119 Tahun 2023).')}</span></label>
        ${KP.sah ? `<div class="route-form">${ui.placeField('rSah', 'Tempat Sah', KP.sahId ? ui.placeLabel(KP.sahId) : '', 'Kota lokasi cuti/WFA/tugas lain…')}</div>
        <div class="kp-row"><span class="kp-lbl">Dari/ke Tempat Sah saat</span>${segP('sahArah', [['go', 'Berangkat'], ['back', 'Pulang'], ['both', 'Keduanya']], KP.sahArah)}</div>` : ''}
        <div class="kp-pd">${pdRef('sah')}</div>
      </div>
      <div class="kp-opt">
        <label class="kp-fld"><span>Biaya layanan, bagasi, dan sejenisnya ${tip('Biaya layanan yang tidak dapat dihindari pada pengadaan tiket, moda transportasi, dan penginapan (biaya platform/penyedia layanan, bagasi, dan lainnya yang tidak termasuk harga tiket). Dapat diberikan sepanjang ada pernyataan Pelaksana SPD, tertulis atau melalui sistem, setelah mendapat persetujuan PPK. SBM tidak menetapkan angkanya; diisi sesuai biaya riil.')}</span><span class="kp-kurs"><b>Rp</b><input id="kpLay" type="text" inputmode="numeric" autocomplete="off" placeholder="Kosongkan bila tidak ada" value="${KP.layanan ? esc(Number(KP.layanan).toLocaleString('id-ID')) : ''}"></span></label>
        <div class="kp-pd">${pdRef('layanan')}</div>
      </div>
    </div>`;
  return `<div class="card card-pad kp-form">
    <div class="kp-step"><h2 class="kp-h"><span class="step">1</span>Tujuan surat tugas</h2>
      ${seg('lingkup', [{ v: 'dn', t: 'Luar kota' }, { v: 'dk', t: 'Dalam kota' }, { v: 'ln', t: 'Luar negeri' }], L)}
      ${tujuan}
    </div>
    <div class="kp-step"><h2 class="kp-h"><span class="step">2</span>Lama perjalanan</h2>
      <div class="kp-row"><span class="kp-lbl">Hari</span>${stepper('hari', KP.hari, 1, 365, 'hari')}</div>
      ${L === 'dn' ? `<div class="kp-row"><span class="kp-lbl">Malam menginap ${tip('Bawaan 1 malam untuk 1 hari, lalu jumlah hari dikurangi satu (2 hari 1 malam, 3 hari 2 malam, dan seterusnya). Bisa diubah dari 0 sampai sama dengan jumlah hari.')}</span>${stepper('malam', KP.malam, 0, KP.hari, 'malam')}</div>` : ''}
    </div>
    <div class="kp-step"><h2 class="kp-h"><span class="step">3</span>Pelaksana</h2>
      ${peopleTable(TINGKAT, L === 'dk' ? null : kelasCell, (t) => stepper('org:' + t.k, KP.org[t.k], 0, 999, 'pelaksana ' + t.n), L === 'ln' ? (t) => ` <small class="kp-gol">Gol. ${GOL[t.k]}</small>` : null, L === 'ln' ? 'Kelas tiket' : 'Kelas pesawat')}
      ${note ? `<div class="muted small kp-note">${note}</div>` : ''}
    </div>
    ${extra}
  </div>`;
}

// Tabel pelaksana: kolom tingkat, kelas (opsional), jumlah orang — dengan judul kolom dan garis pembatas
export function peopleTable(list, kelasCell, countCell, nameExtra = null, kelasHead = 'Kelas pesawat') {
  return `<div class="kp-ptab${kelasCell ? '' : ' nk'}" role="table" aria-label="Pelaksana per tingkat">
    <div class="kp-ph" role="row"><span role="columnheader">Tingkat</span>${kelasCell ? `<span role="columnheader">${esc(kelasHead)}</span>` : ''}<span role="columnheader" class="r">Jumlah orang</span></div>
    ${list.map((t) => `<div class="kp-p" role="row"><span class="kp-pn" role="cell" title="${esc(t.n)}">${esc(t.s)}${nameExtra ? nameExtra(t) : ''}</span>${kelasCell ? `<span role="cell" class="kp-kcell">${kelasCell(t)}</span>` : ''}<span role="cell" class="r">${countCell(t)}</span></div>`).join('')}
  </div>`;
}

export const sifatChip = (s) => `<span class="chip ${s === 'BT' ? 'bt' : 'dl'}">${s === 'BT' ? 'Batas Tertinggi' : 'Dapat Dilampaui'}</span>`;
export const byrChip = (l) => `<span class="chip byr ${l.byr}" title="${esc(`${BYR[l.byr]}, ${pdTxt(l.byrRef || 'lumpsum')}`)}">${BYR[l.byr]}</span>`;
const sumsTxt = (sums) => ['IDR', 'USD'].filter((c) => sums[c]).map((c) => (c === 'USD' ? fmtUsd(sums[c]) : fmt(Math.round(sums[c])))).join(' + ') || fmt(0);
const groupsOf = (lines) => [...new Set(lines.map((l) => l.g))];
export function summaryTxt(res) {
  if (res.lingkup === 'dk') return `Dalam kota · ${res.D.label} · ${KP.hari} hari${KP.delapan ? ', lebih dari 8 jam' : ''} · ${res.total} orang`;
  if (res.lingkup === 'ln') return `${res.O.label} – ${res.city || res.neg}${res.city && res.neg ? ` (${res.neg})` : ''} · ${KP.hari} hari · ${res.total} orang`;
  return `${res.O.label} – ${res.D.label} · ${KP.hari} hari ${KP.malam} malam · ${res.total} orang`;
}
export const fmtUsd = (n) => fmt(Math.round(n * 100) / 100, 'USD');
// Baris total: per mata uang, lalu total Rupiah bila ada kurs
export function totalRows(res) {
  if (!res.hasUsd) return [['Perkiraan total', fmt(res.grand)]];
  const rows = [];
  if (res.tot.IDR) rows.push(['Jumlah dalam Rupiah', fmt(res.tot.IDR)]);
  rows.push(['Jumlah dalam dolar AS', fmtUsd(res.tot.USD || 0)]);
  if (res.kurs) rows.push([`Perkiraan total (kurs Rp${kursTxt(res.kurs)})`, fmt(res.grand)]);
  return rows;
}

export function resultHtml(res, effNotice) {
  const L = KP.lingkup;
  if (!res.ready) return `<div class="empty small">${L === 'ln' ? 'Pilih kota atau negara tujuan untuk menghitung perkiraan biaya.' : L === 'dk' ? 'Pilih kabupaten/kota tempat kegiatan.' : 'Pilih kota tujuan untuk menghitung perkiraan biaya.'}</div>`;
  if (res.dalamKota) return `<div class="callout">${ic('info')}<div><b>Asal dan tujuan berada di kabupaten/kota yang sama.</b> Ini perjalanan dinas dalam kota. <button type="button" class="btn sm" data-to-dk>Hitung sebagai dalam kota</button></div></div>`;
  if (!res.total) return `<div class="empty small">Tambahkan minimal satu pelaksana di langkah 3.</div>`;
  const { table, per } = resTable(res);
  const check = res.lines.filter((l) => !l.missing).map((l) => `<li><b>${esc(l.label)}</b>${l.sub ? ` · ${esc(l.sub)}` : ''}: ${esc(l.vol)}</li>`).join('');
  const notes = [];
  if (res.alt.length) notes.push(`Rute tiket lain yang juga tercantum: ${res.alt.map(esc).join('; ')}. Perhitungan memakai rute pertama.`);
  if (res.missing.length) notes.push('Komponen yang tidak tercantum di tabel tidak ikut dijumlahkan.');
  const base = L === 'dk'
    ? `Transpor kegiatan dihitung satu kali pergi-pulang per hari per orang.${KP.delapan ? '' : ' Uang harian dan representasi dalam kota tidak dihitung karena tidak lebih dari 8 jam.'}`
    : L === 'ln'
      ? `Angka luar negeri dalam dolar AS sesuai SBM. ${res.O.dki ? 'Taksi di Jakarta dihitung 2 kali (berangkat dan pulang).' : 'Perjalanan ke Jakarta mengikuti SBM Perjalanan (taksi di kota asal 2 kali, tiket PP ke Jakarta).'} SBM tidak menetapkan satuan biaya penginapan luar negeri, jadi tidak dihitung.${res.hasUsd && !res.kurs ? ' Isi kurs untuk melihat total dalam Rupiah.' : ''}`
      : `Taksi dan transport darat dihitung 2 kali, berangkat dan pulang (${pdRef('transpor')}). Tiket dan taksi bersifat dapat dilampaui, jadi angkanya acuan, bukan batas.${res.non ? ' Penginapan dihitung 30% dari tarif hotel karena tidak menginap di hotel.' : ''}`;
  return `${effNotice()}
  <div class="card kp-res">
    <div class="kp-res-h"><div><div class="kp-title">Perkiraan biaya perjalanan dinas${L === 'dk' ? ' dalam kota' : L === 'ln' ? ' luar negeri' : ''}</div><div class="muted small">${esc(summaryTxt(res))}</div></div>
      <div class="kp-actions">${editBtn()}<button type="button" class="btn primary" id="kpPdf">${ic('download')} Unduh PDF</button></div></div>
    ${table}
    ${per}
    ${sahHtml(res)}
    <div class="kp-foot muted small">Satuan biaya mengikuti SBM TA ${Y.y} (${esc(Y.src)})${res.effOn ? ', dengan persentase dibayar yang sedang aktif' : ''}. ${base} ${notes.join(' ')}</div>
  </div>
  ${fold('Daftar periksa komponen', `<ul class="kp-check">${check}</ul>`)}`;
}

// Perbandingan Tempat Sah dengan Tempat Kedudukan (Pasal 8 ayat (3b))
export function sahTxt(res) {
  const s = res.sah; if (!s) return null;
  const arah = s.go && s.back ? 'berangkat dari dan pulang ke' : s.go ? 'berangkat dari' : 'pulang ke';
  const alt = res.grand - s.batas + Math.min(s.est, s.batas);
  return { arah, alt, lebih: s.est > s.batas };
}
function sahHtml(res) {
  const s = res.sah; if (!s) return '';
  const x = sahTxt(res);
  return `<div class="kp-sah">
    <div class="kp-sah-h">${ic('map-pin')}<b>Tempat Sah: ${esc(plain(s.SA.label))}</b>${pdRef('sah')}</div>
    <div class="kp-sah-r"><span>Estimasi transportasi bila ${x.arah} Tempat Sah</span><b>${fmt(s.est)}</b></div>
    <div class="kp-sah-r"><span>Paling banyak dibayar: estimasi dari Tempat Kedudukan (transportasi di tabel)</span><b>${fmt(s.batas)}</b></div>
    <div class="kp-sah-r tot"><span>Perkiraan total bila memakai Tempat Sah</span><b>${fmt(x.alt)}</b></div>
    <p class="muted small">Transportasi dari/ke Tempat Sah dibayar sesuai biaya riil, paling banyak sebesar estimasi dari Tempat Kedudukan ke Tempat Tujuan. ${x.lebih ? 'Estimasi dari Tempat Sah lebih tinggi, jadi yang dipakai batas dari Tempat Kedudukan.' : 'Estimasi dari Tempat Sah tidak melebihi batas.'} Estimasi per arah: taksi 1 kali di tiap kota, transport darat 1 kali, tiket sekali jalan (½ dari tarif PP SBM).${s.miss ? ' Sebagian komponen tidak tercantum di tabel SBM dan tidak ikut dihitung.' : ''}</p>
  </div>`;
}

// Tabel komponen + ringkasan per orang (dipakai Hitung Perjalanan, banyak tujuan, dinas pindah)
export function resTable(res) {
  const rows = groupsOf(res.lines).map((g) => {
    const ls = res.lines.filter((l) => l.g === g);
    return `<tr class="grp"><td colspan="4">${esc(g)}</td></tr>` + ls.map((l) => `<tr${l.missing ? ' class="miss"' : ''}>
      <td><div class="kp-k">${esc(l.label)}</div>${l.sub ? `<div class="kp-sub">${esc(l.sub)}</div>` : ''}<div class="kp-meta">${l.sifat ? sifatChip(l.sifat) : ''}${l.byr ? byrChip(l) : ''}${l.ref ? `<a class="chip ref" href="${l.ref.href}">${esc(l.ref.label)}</a>` : ''}${l.pd ? pdRef(l.pd) : ''}${l.missing || !l.t ? '' : effMini([tableKey(l.t)])}</div></td>
      <td class="n" data-l="Satuan biaya">${l.manual ? fmt(l.n) : l.n != null ? money(l.t, l.n, l.cur) : '<span class="na">Tidak tercantum</span>'}</td>
      <td class="vol" data-l="Volume">${esc(l.vol)}</td>
      <td class="n tot" data-l="Jumlah">${l.amount != null ? (l.cur === 'USD' ? fmtUsd(l.amount) : fmt(l.amount)) : '–'}</td>
    </tr>`).join('');
  }).join('');
  const foot = totalRows(res).map(([k, v], i, a) => `<tr${i < a.length - 1 ? ' class="sub"' : ''}><td colspan="2">${esc(k)}</td><td colspan="2" class="n">${v}</td></tr>`).join('');
  const per = res.perPerson.length ? `<div class="kp-pps"><div class="kp-pps-h">Per orang</div>${res.perPerson.map((p) => `<div class="kp-pp"><span>${esc(p.n)}${p.c > 1 ? ` <small>× ${p.c}</small>` : ''}</span><b>${sumsTxt(p.sums)}</b></div>`).join('')}</div>` : '';
  const table = `<div class="tbl-wrap kp-tbl"><table class="t kp-t">
      <thead><tr><th>Komponen</th><th class="n">Satuan biaya</th><th>Volume</th><th class="n">Jumlah</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>${foot}</tfoot>
    </table></div>`;
  return { table, per };
}

// ---------- PDF ----------
let pdfLib = null;
export function loadScript(src) {
  return new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
}
export async function lib() {
  if (!pdfLib) pdfLib = loadScript('vendor/jspdf.umd.min.js').then(() => loadScript('vendor/jspdf.plugin.autotable.min.js'));
  await pdfLib;
  return window.jspdf.jsPDF;
}
// Teks aman untuk font standar PDF (helvetica WinAnsi tidak memuat · dan ³ dengan benar)
const pt = (s) => plain(s).replace(/ · /g, ' - ').replace(/·/g, '-').replace(/³/g, '3').replace(/−/g, '-').replace(/–/g, '-');
const fmtPdf = (n) => (n == null ? '-' : fmt(n));
export const WEB = 'cek-sbm.vercel.app';
const NAVY = [34, 45, 99];
// Teks dengan potongan tebal, dibungkus per kata
function richText(doc, segs, x, y, maxW, lh) {
  const words = [];
  segs.forEach((sg) => String(sg.t).split(/(\s+)/).forEach((w) => { if (w) words.push({ w, b: sg.b, url: sg.url }); }));
  let cx = x, cy = y;
  for (const it of words) {
    doc.setFont('helvetica', it.b ? 'bold' : 'normal');
    const ww = doc.getTextWidth(it.w);
    if (/^\s+$/.test(it.w)) { if (cx > x) cx += ww; continue; }
    if (cx + ww > x + maxW && cx > x) { cx = x; cy += lh; }
    if (it.url) doc.textWithLink(it.w, cx, cy, { url: it.url }); else doc.text(it.w, cx, cy);
    cx += ww;
  }
  doc.setFont('helvetica', 'normal');
  return cy;
}
// Kop dan kaki halaman semua PDF aplikasi
export function pdfHead(doc, title, sub = `Standar Biaya Masukan TA ${Y.y} (${Y.src})`) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(...NAVY); doc.rect(0, 0, W, 4, 'F');
  doc.setFillColor(244, 190, 22); doc.rect(0, 4, W, 1.2, 'F');
  doc.setTextColor(...NAVY); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text(title, 14, 16);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(80, 86, 110);
  doc.text(sub, 14, 21.5);
}
export const PDF_BOTTOM = 22; // ruang kaki halaman (mm)
export function pdfFooter(doc) {
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const pages = doc.getNumberOfPages();
  const stamp = new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(215, 219, 232); doc.setLineWidth(0.2); doc.line(14, H - 15.5, W - 14, H - 15.5);
    doc.setFontSize(7.4); doc.setTextColor(95, 100, 125);
    richText(doc, [
      { t: 'Bukan dokumen resmi.', b: true },
      { t: ' Angka ini perkiraan dari satuan biaya SBM sebagai alat bantu hitung. ' },
      { t: 'Setiap keputusan pembayaran dan pertanggungjawaban tetap wajib dicek ke PMK/KMK aslinya.', b: true },
      { t: ` Dibuat ${stamp} di ` }, { t: WEB, url: `https://${WEB}` }, { t: '.' },
    ], 14, H - 11.8, W - 40, 3.2);
    doc.setFontSize(7.5); doc.setTextColor(120, 126, 150);
    doc.text(`${i}/${pages}`, W - 14, H - 11.8, { align: 'right' });
  }
}
// PDF tabel sederhana untuk alat hitung (Invoice, Pajak, Honorarium, Paket Kegiatan)
// spec: { title, sub?, info: [[k, v]], sections: [{ title?, head, body, foot?, cols? }], notes: [], file }
export async function buildTablePdf(spec) {
  const jsPDF = await lib();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  pdfHead(doc, spec.title, spec.sub);
  let y = 26;
  if (spec.info?.length) {
    doc.autoTable({ startY: y, body: spec.info.map((r) => r.map((c) => pt(c))), theme: 'plain', styles: { fontSize: 9.5, cellPadding: 1.2, textColor: [30, 34, 52] }, columnStyles: { 0: { cellWidth: 34, fontStyle: 'bold' } }, margin: { left: 14, right: 14, bottom: PDF_BOTTOM } });
    y = doc.lastAutoTable.finalY + 4;
  }
  for (const sec of spec.sections) {
    if (sec.title) {
      if (y > 262) { doc.addPage(); y = 16; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...NAVY); doc.text(pt(sec.title), 14, y + 3); doc.setFont('helvetica', 'normal'); y += 6;
    }
    const right = sec.right || [];
    doc.autoTable({
      startY: y, head: [sec.head.map(pt)], body: sec.body.map((r) => r.map((c) => (typeof c === 'string' ? pt(c) : c))),
      foot: sec.foot ? sec.foot.map((r) => r.map((c) => (typeof c === 'string' ? pt(c) : c))) : undefined,
      theme: 'grid',
      styles: { fontSize: 8.6, cellPadding: 1.8, lineColor: [215, 219, 232], lineWidth: 0.2, textColor: [30, 34, 52], valign: 'top' },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [255, 246, 214], textColor: NAVY, fontStyle: 'bold', fontSize: 9.2 },
      columnStyles: sec.cols || {},
      didParseCell: (d) => { if (right.includes(d.column.index)) d.cell.styles.halign = 'right'; },
      margin: { left: 14, right: 14, bottom: PDF_BOTTOM },
    });
    y = doc.lastAutoTable.finalY + 6;
  }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(90, 96, 120);
  for (const n of spec.notes || []) { const t = doc.splitTextToSize('- ' + pt(n), W - 28); if (y + t.length * 3.6 > 297 - PDF_BOTTOM) { doc.addPage(); y = 16; } doc.text(t, 14, y); y += t.length * 3.6 + 0.8; }
  pdfFooter(doc);
  return { blob: doc.output('blob'), name: spec.file };
}
export function downloadBlob(out) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(out.blob); a.download = out.name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
// Tombol unduh PDF: status menyiapkan, lalu unduh; make() mengembalikan { blob, name }
export function pdfButton(btn, make, toast) {
  if (!btn) return;
  btn.onclick = async () => {
    btn.disabled = true; const old = btn.innerHTML; btn.innerHTML = `${ic('clock')} Menyiapkan PDF…`;
    try { downloadBlob(await make()); toast && toast('PDF diunduh'); } catch (err) { console.error(err); toast && toast('PDF gagal dibuat'); } finally { btn.disabled = false; btn.innerHTML = old; }
  };
}

// Rincian per orang: komponen yang diterima satu orang di tiap tingkat, untuk pengujian.
// Biaya per orang di satu tingkat SBM selalu sama, jadi rincian per tingkat = rincian per orang.
export function perOrang(res) {
  const roundC = (v, cur) => (cur === 'USD' ? Math.round(v * 100) / 100 : Math.round(v));
  const groups = res.people.map((p) => {
    const rows = [];
    const sums = {};
    for (const l of res.lines) {
      if (l.unit == null || l.manual || l.missing) continue;
      const q = l.perAll ? l.perAll : l.per === p.k ? (l.perQty || 1) : 0;
      if (!q) continue;
      const amt = roundC(l.unit * q, l.cur);
      sums[l.cur] = (sums[l.cur] || 0) + amt;
      let vol = String(l.vol || '').replace(/ × [\d.,]+ orang$/, '');
      if (/^[\d.,]+ orang$/.test(vol)) vol = /^tiket/.test(l.cat) ? '1 tiket' : '1';
      rows.push({ l, q, amt, vol });
    }
    return { p, rows, sums };
  });
  const shared = res.lines.filter((l) => l.amount != null && !l.missing && (l.manual || (!l.perAll && !l.per)));
  return { groups, shared };
}
function pdfPerOrang(doc, res) {
  if (!res.people?.length) return;
  const { groups, shared } = perOrang(res);
  if (!groups.some((g) => g.rows.length)) return;
  const W = doc.internal.pageSize.getWidth();
  const fc = (n, cur) => (n == null ? '-' : cur === 'USD' ? fmtUsd(n) : fmt(n));
  const mul = (sums, c) => Object.fromEntries(Object.entries(sums).map(([k, v]) => [k, v * c]));
  const grid = {
    theme: 'grid', styles: { fontSize: 8.6, cellPadding: 1.8, lineColor: [215, 219, 232], lineWidth: 0.2, textColor: [30, 34, 52], valign: 'top' },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' }, footStyles: { fillColor: [255, 246, 214], textColor: NAVY, fontStyle: 'bold' },
    columnStyles: { 1: { cellWidth: 34, halign: 'right' }, 2: { cellWidth: 42 }, 3: { cellWidth: 34, halign: 'right' } },
    didParseCell: (d) => { if ((d.section === 'head' || d.section === 'foot') && (d.column.index === 1 || d.column.index === 3)) d.cell.styles.halign = 'right'; },
    margin: { left: 14, right: 14, bottom: PDF_BOTTOM },
  };
  doc.addPage();
  pdfHead(doc, 'Rincian per Orang', 'Komponen yang diterima satu orang di tiap tingkat, untuk pengujian');
  let y = 26;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.6); doc.setTextColor(80, 86, 110);
  const intro = doc.splitTextToSize(pt('Satuan biaya SBM ditetapkan per tingkat, sehingga setiap orang dalam tingkat yang sama menerima rincian yang sama. Contoh: pejabat eselon IV dan pelaksana golongan II sama-sama tingkat Eselon IV/Golongan III/II/I.'), W - 28);
  doc.text(intro, 14, y); y += intro.length * 3.8 + 3;
  for (const g of groups) {
    if (!g.rows.length) continue;
    if (y > 240) { doc.addPage(); y = 16; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...NAVY);
    doc.text(pt(`${g.p.n}: ${g.p.c} orang`), 14, y + 3); doc.setFont('helvetica', 'normal'); y += 5.5;
    doc.autoTable({
      ...grid, startY: y,
      head: [['Komponen', 'Satuan biaya', 'Volume per orang', 'Jumlah per orang']],
      body: g.rows.map(({ l, amt, vol }) => [pt(l.label), fc(l.unit, l.cur), pt(vol), fc(amt, l.cur)]),
      foot: [[{ content: 'Jumlah per orang', colSpan: 3 }, sumsTxt(g.sums)], ...(g.p.c > 1 ? [[{ content: `x ${g.p.c} orang`, colSpan: 3 }, sumsTxt(mul(g.sums, g.p.c))]] : [])],
    });
    y = doc.lastAutoTable.finalY + 7;
  }
  // Rekonsiliasi dengan total halaman 1
  if (y > 230) { doc.addPage(); y = 16; }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...NAVY); doc.text('Rekonsiliasi', 14, y + 3); doc.setFont('helvetica', 'normal'); y += 5.5;
  const tot = {};
  const add = (sums) => { for (const [k, v] of Object.entries(sums)) tot[k] = (tot[k] || 0) + v; };
  const body = groups.filter((g) => g.rows.length).map((g) => { const m = mul(g.sums, g.p.c); add(m); return [pt(`${g.p.n} (${g.p.c} orang)`), sumsTxt(m)]; });
  for (const l of shared) { add({ [l.cur]: l.amount }); body.push([pt(`${l.label}${l.manual ? ' (isian pengguna)' : ''}, tidak dibagi per orang`), fc(l.amount, l.cur)]); }
  const diff = {};
  for (const c of Object.keys(res.tot || {})) { const d = Math.round(((res.tot[c] || 0) - (tot[c] || 0)) * 100) / 100; if (Math.abs(d) >= 0.01) diff[c] = d; }
  if (Object.keys(diff).length) { body.push(['Selisih pembulatan (jumlah per baris di halaman 1 dibulatkan dari total)', sumsTxt(diff)]); add(diff); }
  doc.autoTable({
    ...grid, startY: y, head: [['Bagian', 'Jumlah']], body,
    foot: [['Total (sama dengan halaman 1)', sumsTxt(tot)]],
    columnStyles: { 1: { cellWidth: 50, halign: 'right' } },
    didParseCell: (d) => { if (d.column.index === 1) d.cell.styles.halign = 'right'; },
  });
}

export async function buildPdf(res) {
  const jsPDF = await lib();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const navy = NAVY;
  const C = res.custom || null;
  pdfHead(doc, C ? C.title : `Perkiraan Biaya Perjalanan Dinas${res.lingkup === 'dk' ? ' Dalam Kota' : res.lingkup === 'ln' ? ' Luar Negeri' : ''}`);
  const L = res.lingkup;
  const ppl = ['Pelaksana', res.people.map((p) => `${p.n}${L === 'ln' ? ` [Gol. ${GOL[p.k]}]` : ''} (${p.c})`).join('; ')];
  const info = C ? C.info : L === 'dk' ? [
    ['Lingkup', 'Dalam kota'], ['Tempat', `${plain(res.D.label)} (${S.prov[res.D.prov].nama})`],
    ['Lama', `${KP.hari} hari${KP.delapan ? ', lebih dari 8 jam' : ', tidak lebih dari 8 jam'}`], ppl,
  ] : L === 'ln' ? [
    ['Lingkup', 'Luar negeri'], ['Asal', plain(res.O.label)], ['Tujuan', `${res.city || '-'}${res.neg ? ` (uang harian: ${res.neg})` : ''}`],
    ['Lama', `${KP.hari} hari`], ...(res.kurs ? [['Kurs', `Rp${kursTxt(res.kurs)} per US$`]] : []), ppl,
  ] : [
    ['Asal', plain(res.O.label)], ['Tujuan', `${plain(res.D.label)} (${S.prov[res.D.prov].nama})`],
    ['Lama', `${KP.hari} hari, ${KP.malam} malam`], ['Uang harian', KP.jenis === 'diklat' ? 'Diklat' : 'Luar kota'], ppl,
    ...(res.non ? [['Penginapan', 'Tidak menginap di hotel (30% tarif hotel)']] : []),
    ...(res.sah ? [['Tempat Sah', `${plain(res.sah.SA.label)} (${sahTxt(res).arah} Tempat Sah)`]] : []),
  ];
  doc.autoTable({ startY: 26, body: info.map((r) => r.map((c) => pt(c))), theme: 'plain', styles: { fontSize: 9.5, cellPadding: 1.2, textColor: [30, 34, 52] }, columnStyles: { 0: { cellWidth: 28, fontStyle: 'bold' } }, margin: { left: 14, right: 14, bottom: PDF_BOTTOM } });
  const body = [];
  const fc = (n, cur) => (n == null ? '-' : cur === 'USD' ? fmtUsd(n) : fmt(n));
  for (const g of groupsOf(res.lines)) {
    const ls = res.lines.filter((l) => l.g === g);
    body.push([{ content: pt(g), colSpan: 5, styles: { fontStyle: 'bold', fillColor: [238, 241, 250], textColor: navy } }]);
    for (const l of ls) {
      const p = l.t ? effPct(l.t) : 100;
      const unit = l.n == null ? 'Tidak tercantum' : p < 100 ? `${fc(l.unit, l.cur)}\n(${pctTxt(p)} dari ${fc(l.n, l.cur)})` : fc(l.n, l.cur);
      const rj = [l.ref ? l.ref.label : 'Isian pengguna', l.byr ? BYR[l.byr] : '', l.pd ? pdTxt(l.pd) : ''].filter(Boolean).join('\n');
      body.push([`${pt(l.label)}${l.sub ? '\n' + pt(l.sub) : ''}`, rj, unit, pt(l.vol), fc(l.amount, l.cur)]);
    }
  }
  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 4,
    head: [['Komponen', 'Rujukan', 'Satuan biaya', 'Volume', 'Jumlah']],
    body,
    foot: totalRows(res).map(([k, v]) => [{ content: k, colSpan: 4 }, v]),
    theme: 'grid',
    styles: { fontSize: 8.6, cellPadding: 1.8, lineColor: [215, 219, 232], lineWidth: 0.2, textColor: [30, 34, 52], valign: 'top' },
    headStyles: { fillColor: navy, textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [255, 246, 214], textColor: navy, fontStyle: 'bold', fontSize: 9.5 },
    columnStyles: { 1: { cellWidth: 34 }, 2: { halign: 'right', cellWidth: 34 }, 3: { cellWidth: 32 }, 4: { halign: 'right', cellWidth: 30 } },
    didParseCell: (d) => { if (d.section === 'foot' && d.column.index === 4) d.cell.styles.halign = 'right'; if (d.section === 'head' && (d.column.index === 2 || d.column.index === 4)) d.cell.styles.halign = 'right'; },
    margin: { left: 14, right: 14, bottom: PDF_BOTTOM },
  });
  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 4,
    head: [['Per orang', 'Jumlah']],
    body: (res.perPerson.length ? res.perPerson : [{ n: '-', c: 1, sums: {} }]).map((p) => [`${p.n}${p.c > 1 ? ` (x ${p.c})` : ''}`, sumsTxt(p.sums)]),
    theme: 'grid', styles: { fontSize: 8.6, cellPadding: 1.8, lineColor: [215, 219, 232], lineWidth: 0.2 },
    headStyles: { fillColor: [238, 241, 250], textColor: navy, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right', cellWidth: 50 } }, margin: { left: 14, right: 14, bottom: PDF_BOTTOM },
  });
  const notes = C ? [...C.notes] : L === 'dk' ? [
    'Transpor kegiatan dalam kabupaten/kota dihitung satu kali pergi-pulang per hari per orang.',
    KP.delapan ? 'Uang harian dan representasi dalam kota memakai kolom lebih dari 8 jam.' : 'Uang harian dan representasi dalam kota tidak dihitung (tidak lebih dari 8 jam).',
  ] : L === 'ln' ? [
    'Tiket dan uang harian luar negeri dalam dolar AS sesuai SBM; tiket luar negeri PP dari Jakarta.',
    res.O.dki ? 'Taksi di Jakarta dihitung 2 kali (berangkat dan pulang).' : 'Perjalanan ke Jakarta: taksi di kota asal 2 kali dan tiket/transport PP ke Jakarta.',
    'Golongan uang harian: Pejabat Negara/Wamen A; Eselon I dan Pejabat Negara Lainnya B; Eselon II C; lainnya termasuk pelaksana D.',
    'SBM tidak menetapkan satuan biaya penginapan luar negeri; tidak dihitung.',
    ...(res.kurs ? [`Total Rupiah memakai kurs Rp${kursTxt(res.kurs)} per US$ yang diisi pengguna.`] : []),
  ] : [
    `Satuan biaya mengikuti SBM; taksi dan transport darat dihitung 2 kali, berangkat dan pulang (${pdTxt('transpor')}).`,
    'Tiket dan taksi bersifat dapat dilampaui (acuan); uang harian, penginapan, dan representasi bersifat batas tertinggi.',
    `Kelas pesawat sesuai ${pdTxt('lamp4')}. Cara bayar (lumpsum/biaya riil) mengikuti ${pdTxt('lumpsum')}.`,
    ...(res.non ? [`Tidak menginap di hotel: penginapan 30% dari tarif hotel kota tujuan, dibayar lumpsum (${pdTxt('inap30')}).`] : []),
    ...(res.lines.some((l) => l.manual) ? [`Biaya layanan diisi pengguna sesuai biaya riil (${pdTxt('layanan')}); bukan angka SBM.`] : []),
    ...(res.sah ? [`Tempat Sah ${plain(res.sah.SA.label)}: estimasi transportasi ${fmt(res.sah.est)}; dibayar riil paling banyak sebesar estimasi dari Tempat Kedudukan ${fmt(res.sah.batas)} (${pdTxt('sah')}). Perkiraan total bila memakai Tempat Sah ${fmt(sahTxt(res).alt)}.`] : []),
  ];
  if (res.effOn) notes.push('Sebagian satuan biaya memakai persentase dibayar (simulasi efisiensi); besaran SBM resmi tercantum di kolom Satuan biaya.');
  if (res.missing.length) notes.push('Komponen yang tidak tercantum di tabel SBM tidak ikut dijumlahkan.');
  let y = doc.lastAutoTable.finalY + 6;
  doc.setFontSize(8); doc.setTextColor(90, 96, 120);
  for (const n of notes) { const t = doc.splitTextToSize('- ' + pt(n), W - 28); if (y + t.length * 3.6 > 297 - PDF_BOTTOM) { doc.addPage(); y = 16; } doc.text(t, 14, y); y += t.length * 3.6 + 0.8; }
  pdfPerOrang(doc, res);
  pdfFooter(doc);
  if (C) return { blob: doc.output('blob'), name: C.file };
  const dest = res.lingkup === 'ln' ? `LN-${res.city || res.neg}` : `${res.lingkup === 'dk' ? 'Dalam-Kota-' : ''}${plain(res.D.label)}`;
  const name = `Perkiraan-Perjadin-${dest.replace(/[^\w]+/g, '-')}-${KP.hari}hari-TA${Y.y}.pdf`.replace(/-+/g, '-');
  return { blob: doc.output('blob'), name };
}
