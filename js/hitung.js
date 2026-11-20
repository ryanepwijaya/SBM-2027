// Hitung Perjalanan: perkiraan biaya perjalanan dinas (dalam negeri luar kota, dalam kota, luar negeri).
// Hanya menampilkan angka SBM yang relevan dikali volume; tidak menerapkan aturan PMK Perjalanan Dinas.
import { S, Y, esc, fmt, valueCols, money, effVal, effPct, pctTxt, fold, tip, rapatTiers, effMini, tableKey } from './store.js';
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
export const FB_TIER = { pn: 0, e1: 1, pnl: 1, e2: 1, e3: 2, e4: 2 };
const FB_TIER_N = ['Menteri/Wamen', 'Eselon I dan II/JF Utama', 'Eselon III/JF Madya ke bawah'];

// Isian bertahan selama aplikasi terbuka (tidak disimpan ke perangkat)
export const KP = {
  lingkup: 'dn', dari: 'jakarta', ke: '', jenis: 'lk', hari: 1, malam: 1, malamManual: false, delapan: true,
  lnAsal: 'jakarta', lnKota: '', lnNeg: '', kurs: 0,
  org: { pn: 0, e1: 0, pnl: 0, e2: 0, e3: 0, e4: 1 },
  kelas: { pn: 'eko', e1: 'eko', pnl: 'eko', e2: 'eko', e3: 'eko', e4: 'eko' },
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
// Penjumlahan per mata uang, per orang, dan total Rupiah (USD dikonversi bila kurs diisi)
export function finish(o, lines, people, kurs = 0) {
  const tot = {};
  for (const l of lines) if (l.amount != null) tot[l.cur] = (tot[l.cur] || 0) + l.amount;
  const perPerson = people.map((p) => {
    const sums = {};
    for (const l of lines) {
      if (l.unit == null) continue;
      const q = l.perAll ? l.perAll : l.per === p.k ? (l.perQty || 1) : 0;
      if (q) sums[l.cur] = (sums[l.cur] || 0) + l.unit * q;
    }
    return { ...p, sum: sums.IDR || 0, sums };
  });
  const hasUsd = lines.some((l) => l.cur === 'USD');
  const k = kurs > 0 ? kurs : 0;
  const grand = Math.round((tot.IDR || 0) + (k ? (tot.USD || 0) * k : 0));
  return { ...o, ready: true, lines, people, total: people.reduce((a, t) => a + t.c, 0), perPerson, tot, grand, hasUsd, kurs: k, effOn: lines.some((l) => effPct(l.t) < 100), missing: lines.filter((l) => l.missing) };
}

// Hitung semua baris biaya sesuai lingkup perjalanan
export function compute(state = KP) {
  if (state.lingkup === 'dk') return computeDK(state);
  if (state.lingkup === 'ln') return computeLN(state);
  return computeDN(state);
}

// Dalam negeri, luar kota
function computeDN(state) {
  const O = resolve(state.dari), D = state.ke ? resolve(state.ke) : null;
  if (!O || !D) return { ready: false };
  const people = peopleOf(state);
  const total = people.reduce((a, t) => a + t.c, 0);
  const r = computeRoute(O, D);
  if (r.sameKab) return { ready: true, O, D, r, dalamKota: true };
  const lines = [];
  const add = adder(lines);
  let hasTiket = false;
  const alt = [];
  // Transportasi dari mesin Rute (taksi, tiket, transport darat, Bodetabek)
  for (const sec of r.sec.filter((s) => ['Keberangkatan', 'Perjalanan', 'Kedatangan'].includes(s.h))) {
    for (const it of sec.items) {
      const row = it.code ? rowBy(it.bid, it.code, it.ti) : null;
      const base = { g: 'Transportasi', sec: sec.h, cat: it.bid === 'L2-6' ? 'tiket' : it.bid === 'L2-5' ? 'taksi' : 'darat', bid: it.bid, ti: it.ti, code: it.code, label: plain(it.title) };
      if (!row) { add({ ...base, n: null, qty: 0, vol: 'Tidak tercantum di tabel; mengacu harga riil/pasar', missing: true }); continue; }
      if (it.bid === 'L2-6') {
        if (hasTiket) { alt.push(plain(it.title)); continue; }
        hasTiket = true;
        for (const p of people) {
          const bis = state.kelas[p.k] === 'bis';
          add({ ...base, label: `${plain(it.title)} · ${bis ? 'Bisnis' : 'Ekonomi'}`, sub: p.n, n: row.n[bis ? 3 : 4], qty: p.c, vol: `${p.c} orang`, per: p.k });
        }
      } else if (it.bid === 'L2-5') {
        add({ ...base, n: row.n[3], qty: 2 * total, vol: `2 kali × ${total} orang`, perAll: 2 });
      } else if (it.bid === 'L2-2' || it.bid === 'L2-3') {
        add({ ...base, n: row.n[4], qty: 2 * total, vol: `2 kali (PP) × ${total} orang`, perAll: 2 });
      }
    }
  }
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
  if (uhDays > 0) add({ g: 'Selama di tujuan', cat: 'uh', bid: 'L1-25', ti: 0, code: rUH?.c, label: `Uang harian · ${pName}${state.jenis === 'diklat' ? ' (diklat)' : ''}`, n: rUH ? rUH.n[uhCol] : null, qty: uhDays * total, vol: `${uhDays} hari × ${total} orang`, perAll: uhDays, missing: !rUH });
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
    add({ g: 'Selama di tujuan', cat: 'uhfb', bid: 'L1-29', ti: 1, code: rU?.c, label: 'Uang harian rapat fullboard', n: rU ? rU.n[3] : null, qty: fb * total, vol: `${fb} hari × ${total} orang`, perAll: fb, missing: !rU });
  }
  const tH = S.butir['L1-27'].tables[0];
  const rH = tH.rows.find((x) => x.p === D.prov);
  const vH = valueCols(tH);
  if (nights > 0) {
    for (const p of people) add({ g: 'Selama di tujuan', cat: 'inap', bid: 'L1-27', ti: 0, code: rH?.c, label: `Penginapan · ${pName}`, sub: p.n, n: rH ? rH.n[vH[p.h]] : null, qty: nights * p.c, vol: `${nights} malam × ${p.c} orang`, per: p.k, perQty: nights, missing: !rH });
  }
  const tRep = S.butir['L1-25'].tables[1];
  const repRows = tRep.rows.filter((x) => x.v);
  for (const p of people.filter((x) => x.rep != null)) {
    const rr = repRows[p.rep];
    if (rr) add({ g: 'Selama di tujuan', cat: 'rep', bid: 'L1-25', ti: 1, code: rr.c, label: 'Uang representasi', sub: p.n, n: rr.n[valueCols(tRep)[0]], qty: state.hari * p.c, vol: `${state.hari} hari × ${p.c} orang`, per: p.k, perQty: state.hari });
  }
  return finish({ lingkup: 'dn', O, D, r, alt, hasTiket }, lines, people);
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
  add({ g: 'Transportasi', cat: 'darat', bid: 'L2-4', ti: 0, code: rT?.c, label: 'Transpor kegiatan dalam kabupaten/kota (PP)', n: rT ? rT.n[valueCols(tT)[0]] : null, qty: h * total, vol: `${h} hari × ${total} orang`, perAll: h, missing: !rT });
  if (state.delapan !== false) {
    const pName = S.prov[D.prov].nama;
    const tUH = S.butir['L1-25'].tables[0];
    const rUH = tUH.rows.find((x) => x.p === D.prov);
    add({ g: 'Selama kegiatan', cat: 'uh', bid: 'L1-25', ti: 0, code: rUH?.c, label: `Uang harian dalam kota lebih dari 8 jam · ${pName}`, n: rUH ? rUH.n[valueCols(tUH)[1]] : null, qty: h * total, vol: `${h} hari × ${total} orang`, perAll: h, missing: !rUH });
    const tRep = S.butir['L1-25'].tables[1];
    const repRows = tRep.rows.filter((x) => x.v);
    for (const p of people.filter((x) => x.rep != null)) {
      const rr = repRows[p.rep];
      if (rr) add({ g: 'Selama kegiatan', cat: 'rep', bid: 'L1-25', ti: 1, code: rr.c, label: 'Uang representasi dalam kota', sub: p.n, n: rr.n[valueCols(tRep)[1]], qty: h * p.c, vol: `${h} hari × ${p.c} orang`, per: p.k, perQty: h });
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
    for (const l of dn.lines || []) if (l.g === 'Transportasi' && l.sec !== 'Kedatangan') lines.push({ ...l, g: G1 });
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
  const kelasSel = (t) => L === 'ln'
    ? `<select class="sel kp-kelas" data-kelasln="${t.k}" aria-label="Kelas tiket ${esc(t.n)}">${KELAS_LN.map(([k, n]) => `<option value="${k}"${KP.kelasLn[t.k] === k ? ' selected' : ''}>${n}</option>`).join('')}</select>`
    : `<select class="sel kp-kelas" data-kelas="${t.k}" aria-label="Kelas tiket ${esc(t.n)}"><option value="eko"${KP.kelas[t.k] === 'eko' ? ' selected' : ''}>Ekonomi</option><option value="bis"${KP.kelas[t.k] === 'bis' ? ' selected' : ''}>Bisnis</option></select>`;
  const note = L === 'ln'
    ? 'Jumlah bisa diketik langsung (sampai 999 orang). Golongan uang harian luar negeri: Pejabat Negara/Wamen A, Eselon I dan Pejabat Negara Lainnya B, Eselon II C, lainnya (termasuk pelaksana) D. Kelas Eksekutif/Bisnis memakai tiket dalam negeri kelas Bisnis untuk ke Jakarta.'
    : L === 'dk' ? 'Jumlah bisa diketik langsung (sampai 999 orang).'
      : 'Jumlah bisa diketik langsung (sampai 999 orang). Kelas tiket dipilih per tingkat dan hanya dipakai bila rutenya memakai tiket pesawat.';
  return `<div class="card card-pad kp-form">
    <div class="kp-step"><h2 class="kp-h"><span class="step">1</span>Tujuan surat tugas<button type="button" class="btn sm danger kp-reset" id="kpReset">${ic('history')} Reset</button></h2>
      ${seg('lingkup', [{ v: 'dn', t: 'Luar kota' }, { v: 'dk', t: 'Dalam kota' }, { v: 'ln', t: 'Luar negeri' }], L)}
      ${tujuan}
    </div>
    <div class="kp-step"><h2 class="kp-h"><span class="step">2</span>Lama perjalanan</h2>
      <div class="kp-row"><span class="kp-lbl">Hari</span>${stepper('hari', KP.hari, 1, 365, 'hari')}</div>
      ${L === 'dn' ? `<div class="kp-row"><span class="kp-lbl">Malam menginap ${tip('Bawaan 1 malam untuk 1 hari, lalu jumlah hari dikurangi satu (2 hari 1 malam, 3 hari 2 malam, dan seterusnya). Bisa diubah dari 0 sampai sama dengan jumlah hari.')}</span>${stepper('malam', KP.malam, 0, KP.hari, 'malam')}</div>` : ''}
    </div>
    <div class="kp-step"><h2 class="kp-h"><span class="step">3</span>Pelaksana</h2>
      <div class="kp-people">${TINGKAT.map((t) => `<div class="kp-p">
        <span class="kp-pn" title="${esc(t.n)}">${esc(t.s)}${L === 'ln' ? ` <small class="kp-gol">Gol. ${GOL[t.k]}</small>` : ''}</span>
        ${L === 'dk' ? '<span></span>' : kelasSel(t)}
        ${stepper('org:' + t.k, KP.org[t.k], 0, 999, 'pelaksana ' + t.n)}
      </div>`).join('')}</div>
      <div class="muted small kp-note">${note}</div>
    </div>
  </div>`;
}

const sifatChip = (s) => `<span class="chip ${s === 'BT' ? 'bt' : 'dl'}">${s === 'BT' ? 'Batas Tertinggi' : 'Dapat Dilampaui'}</span>`;
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
      : 'Volume taksi dan transport darat dihitung 2 kali (berangkat dan pulang). Tiket dan taksi bersifat dapat dilampaui, jadi angkanya acuan, bukan batas.';
  return `${effNotice()}
  <div class="card kp-res">
    <div class="kp-res-h"><div><div class="kp-title">Perkiraan biaya perjalanan dinas${L === 'dk' ? ' dalam kota' : L === 'ln' ? ' luar negeri' : ''}</div><div class="muted small">${esc(summaryTxt(res))}</div></div>
      <div class="kp-actions"><button type="button" class="btn primary" id="kpPdf">${ic('download')} Unduh PDF</button></div></div>
    ${table}
    ${per}
    <div class="kp-foot muted small">Satuan biaya mengikuti SBM TA ${Y.y} (${esc(Y.src)})${res.effOn ? ', dengan persentase dibayar yang sedang aktif' : ''}. ${base} ${notes.join(' ')}</div>
  </div>
  ${fold('Daftar periksa komponen', `<ul class="kp-check">${check}</ul>`)}`;
}

// Tabel komponen + ringkasan per orang (dipakai Hitung Perjalanan, banyak tujuan, dinas pindah)
export function resTable(res) {
  const rows = groupsOf(res.lines).map((g) => {
    const ls = res.lines.filter((l) => l.g === g);
    return `<tr class="grp"><td colspan="4">${esc(g)}</td></tr>` + ls.map((l) => `<tr${l.missing ? ' class="miss"' : ''}>
      <td><div class="kp-k">${esc(l.label)}</div>${l.sub ? `<div class="kp-sub">${esc(l.sub)}</div>` : ''}<div class="kp-meta">${sifatChip(l.sifat)}<a class="chip ref" href="${l.ref.href}">${esc(l.ref.label)}</a>${l.missing ? '' : effMini([tableKey(l.t)])}</div></td>
      <td class="n" data-l="Satuan biaya">${l.n != null ? money(l.t, l.n, l.cur) : '<span class="na">Tidak tercantum</span>'}</td>
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
const pt = (s) => plain(s).replace(/ · /g, ' - ').replace(/·/g, '-').replace(/³/g, '3');
const fmtPdf = (n) => (n == null ? '-' : fmt(n));
export async function buildPdf(res) {
  const jsPDF = await lib();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const navy = [34, 45, 99];
  doc.setFillColor(...navy); doc.rect(0, 0, W, 4, 'F');
  doc.setFillColor(244, 190, 22); doc.rect(0, 4, W, 1.2, 'F');
  doc.setTextColor(...navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  const C = res.custom || null;
  doc.text(C ? C.title : `Perkiraan Biaya Perjalanan Dinas${res.lingkup === 'dk' ? ' Dalam Kota' : res.lingkup === 'ln' ? ' Luar Negeri' : ''}`, 14, 16);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(80, 86, 110);
  doc.text(`Standar Biaya Masukan TA ${Y.y} (${Y.src})`, 14, 21.5);
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
  ];
  doc.autoTable({ startY: 26, body: info.map((r) => r.map((c) => pt(c))), theme: 'plain', styles: { fontSize: 9.5, cellPadding: 1.2, textColor: [30, 34, 52] }, columnStyles: { 0: { cellWidth: 28, fontStyle: 'bold' } }, margin: { left: 14, right: 14 } });
  const body = [];
  const fc = (n, cur) => (n == null ? '-' : cur === 'USD' ? fmtUsd(n) : fmt(n));
  for (const g of groupsOf(res.lines)) {
    const ls = res.lines.filter((l) => l.g === g);
    body.push([{ content: pt(g), colSpan: 5, styles: { fontStyle: 'bold', fillColor: [238, 241, 250], textColor: navy } }]);
    for (const l of ls) {
      const p = effPct(l.t);
      const unit = l.n == null ? 'Tidak tercantum' : p < 100 ? `${fc(l.unit, l.cur)}\n(${pctTxt(p)} dari ${fc(l.n, l.cur)})` : fc(l.n, l.cur);
      body.push([`${pt(l.label)}${l.sub ? '\n' + pt(l.sub) : ''}`, l.ref.label, unit, pt(l.vol), fc(l.amount, l.cur)]);
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
    columnStyles: { 1: { cellWidth: 30 }, 2: { halign: 'right', cellWidth: 36 }, 3: { cellWidth: 34 }, 4: { halign: 'right', cellWidth: 30 } },
    didParseCell: (d) => { if (d.section === 'foot' && d.column.index === 4) d.cell.styles.halign = 'right'; if (d.section === 'head' && (d.column.index === 2 || d.column.index === 4)) d.cell.styles.halign = 'right'; },
    margin: { left: 14, right: 14 },
  });
  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 4,
    head: [['Per orang', 'Jumlah']],
    body: (res.perPerson.length ? res.perPerson : [{ n: '-', c: 1, sums: {} }]).map((p) => [`${p.n}${p.c > 1 ? ` (x ${p.c})` : ''}`, sumsTxt(p.sums)]),
    theme: 'grid', styles: { fontSize: 8.6, cellPadding: 1.8, lineColor: [215, 219, 232], lineWidth: 0.2 },
    headStyles: { fillColor: [238, 241, 250], textColor: navy, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right', cellWidth: 50 } }, margin: { left: 14, right: 14 },
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
    'Satuan biaya mengikuti SBM; volume taksi dan transport darat dihitung 2 kali (berangkat dan pulang).',
    'Tiket dan taksi bersifat dapat dilampaui (acuan); uang harian, penginapan, dan representasi bersifat batas tertinggi.',
  ];
  if (res.effOn) notes.push('Sebagian satuan biaya memakai persentase dibayar (simulasi efisiensi); besaran SBM resmi tercantum di kolom Satuan biaya.');
  if (res.missing.length) notes.push('Komponen yang tidak tercantum di tabel SBM tidak ikut dijumlahkan.');
  let y = doc.lastAutoTable.finalY + 6;
  doc.setFontSize(8); doc.setTextColor(90, 96, 120);
  for (const n of notes) { const t = doc.splitTextToSize('- ' + pt(n), W - 28); if (y + t.length * 3.6 > 285) { doc.addPage(); y = 16; } doc.text(t, 14, y); y += t.length * 3.6 + 0.8; }
  const pages = doc.getNumberOfPages();
  const stamp = new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(120, 126, 150);
    doc.text(doc.splitTextToSize(`Perkiraan dari aplikasi bantu baca SBM (cek-sbm.vercel.app, oleh @ryanepwijaya), bukan dokumen resmi. Cek ulang ke ketentuan aslinya. Dibuat ${stamp}.`, W - 48), 14, 288.5);
    doc.text(`${i}/${pages}`, W - 14, 288.5, { align: 'right' });
  }
  if (C) return { blob: doc.output('blob'), name: C.file };
  const dest = res.lingkup === 'ln' ? `LN-${res.city || res.neg}` : `${res.lingkup === 'dk' ? 'Dalam-Kota-' : ''}${plain(res.D.label)}`;
  const name = `Perkiraan-Perjadin-${dest.replace(/[^\w]+/g, '-')}-${KP.hari}hari-TA${Y.y}.pdf`.replace(/-+/g, '-');
  return { blob: doc.output('blob'), name };
}
