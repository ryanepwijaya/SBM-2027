// Perjadin (banyak asal): perkiraan biaya satu kegiatan dengan peserta dari banyak kota asal.
// Memakai mesin hitung Hitung Perjalanan per kota asal, lalu menjumlahkan. Hanya menampilkan angka SBM × volume.
// Isian tersimpan di localStorage perangkat ini saja (tanpa akun, tanpa server).
import { S, Y, esc, fmt, store, tip, effPct, pctTxt, effMini, tableKey } from './store.js';
import { W, resolve, suggest, placeLabel } from './rute.js';
import { ic } from './icons.js';
import { TINGKAT, compute, plain, lib as pdfLib, loadScript, autoMalam } from './hitung.js';

const KEY = 'massal';
const SHORT = { pn: 'PN/Wamen', e1: 'Eselon I', pnl: 'PN Lainnya', e2: 'Eselon II', e3: 'Es. III/Gol. IV', e4: 'Es. IV/Gol. III–I' };
const CATS = [
  ['tiket', 'Tiket pesawat'], ['darat', 'Transport darat'], ['taksi', 'Taksi'],
  ['uh', 'Uang harian'], ['fb', 'Paket rapat fullboard'], ['uhfb', 'Uang harian rapat fullboard'],
  ['inap', 'Penginapan'], ['rep', 'Uang representasi'],
];
const clone = (o) => JSON.parse(JSON.stringify(o));
const zeroOrg = () => Object.fromEntries(TINGKAT.map((t) => [t.k, 0]));
// Kota asal baru langsung berisi 1 pelaksana Eselon IV/Golongan III/II/I, sama seperti Hitung Perjalanan
const newOrg = () => ({ ...zeroOrg(), e4: 1 });
const sumOrg = (o) => TINGKAT.reduce((a, t) => a + (o[t.k] || 0), 0);
const DEF = {
  v: 1, step: 1, ke: '', jenis: 'lk', mode: 'non', hari: 1, malam: 1, malamManual: false, paket: 1, paketManual: false,
  kelas: Object.fromEntries(TINGKAT.map((t) => [t.k, 'eko'])), asal: [], pdfBy: 'kota', single: 'e4', sort: { k: 'prov', d: 1 },
};
function load() {
  const base = clone(DEF);
  const d = store.get(KEY, null);
  if (!d || d.v !== 1) return base;
  return {
    ...base, ...d, kelas: { ...base.kelas, ...(d.kelas || {}) }, sort: { ...base.sort, ...(d.sort || {}) },
    asal: (d.asal || []).filter((a) => a && a.id).map((a) => ({ id: a.id, org: { ...zeroOrg(), ...(a.org || {}) }, dh: a.dh | 0 })),
  };
}
export const MS = load();
let saveT;
function save() { clearTimeout(saveT); saveT = setTimeout(() => store.set(KEY, MS), 200); }
function resetMS() { Object.assign(MS, clone(DEF)); store.set(KEY, MS); }

// Satu kota/kab mewakili satu kota asal. Provinsi → ibu kotanya; seluruh DKI → Jakarta.
function normId(id) {
  if (!id) return null;
  if (id === 'jakarta' || id === 'p-dki') return 'jakarta';
  if (id.startsWith('p-')) return W.data.capital[id.slice(2)] || id;
  if (W.byId[id]?.dki) return 'jakarta';
  return W.byId[id] ? id : null;
}
const capOf = (pid) => (pid === 'dki' ? 'jakarta' : W.data.capital[pid] || 'p-' + pid);
const provOf = (id) => (id === 'jakarta' ? 'dki' : W.byId[id]?.p || (id.startsWith('p-') ? id.slice(2) : null));
const provIdx = Object.create(null);
const provOrder = (pid) => { if (!Object.keys(provIdx).length) S.provList.forEach((p, i) => { provIdx[p.id] = i; }); return provIdx[pid] ?? 99; };
const labelOf = (id) => (id === 'jakarta' ? 'Jakarta' : placeLabel(id) || id);
const isCap = (id) => id === 'jakarta' || Object.values(W.data.capital).includes(id);
function sameAsDest(id) {
  if (!MS.ke) return false;
  const a = resolve(id), d = resolve(MS.ke);
  if (!a || !d) return false;
  return (a.dki && d.dki) || (a.reg && d.reg && a.reg.id === d.reg.id);
}
function addAsal(id) {
  const n = normId(id);
  if (!n || MS.asal.some((a) => a.id === n)) return false;
  MS.asal.push({ id: n, org: newOrg(), dh: 0 });
  return true;
}
const sortAsal = () => MS.asal.sort((a, b) => provOrder(provOf(a.id)) - provOrder(provOf(b.id)) || (isCap(b.id) - isCap(a.id)) || labelOf(a.id).localeCompare(labelOf(b.id), 'id'));

/* ---------------- Hitung ---------------- */
function daysOf(a) {
  const h = Math.max(1, Math.min(365, MS.hari + a.dh));
  const m = Math.max(0, Math.min(h, MS.malam + a.dh));
  return { h, m, p: MS.mode === 'fb' ? Math.min(MS.paket, h) : 0 };
}
export function computeAll() {
  const D = MS.ke ? resolve(MS.ke) : null;
  if (!D) return { ready: false };
  const rows = [];
  for (const a of MS.asal) {
    const O = resolve(a.id);
    if (!O) continue;
    const { h, m, p } = daysOf(a);
    const n = sumOrg(a.org);
    const res = compute({ dari: a.id, ke: MS.ke, jenis: MS.jenis, mode: MS.mode, paket: p, hari: h, malam: m, org: a.org, kelas: MS.kelas });
    const cats = {};
    let tr = 0, st = 0;
    for (const l of res.lines || []) {
      if (l.amount == null || !l.amount) continue;
      cats[l.cat] = (cats[l.cat] || 0) + l.amount;
      if (l.g === 'Transportasi') tr += l.amount; else st += l.amount;
    }
    rows.push({ a, O, prov: O.prov, h, m, p, n, res, cats, tr, st, total: n && !res.dalamKota ? res.grand : 0, dalamKota: !!res.dalamKota, missing: n ? res.missing || [] : [] });
  }
  const live = rows.filter((r) => r.n && !r.dalamKota);
  const cats = {};
  for (const r of live) for (const [k, v] of Object.entries(r.cats)) cats[k] = (cats[k] || 0) + v;
  const byT = zeroOrg();
  for (const r of live) for (const t of TINGKAT) byT[t.k] += r.a.org[t.k] || 0;
  const people = live.reduce((x, r) => x + r.n, 0);
  const grand = live.reduce((x, r) => x + r.total, 0);
  const tr = live.reduce((x, r) => x + r.tr, 0);
  const effOn = live.some((r) => r.res.effOn);
  const hasTiket = live.some((r) => r.res.hasTiket);
  return {
    ready: true, D, rows, live, cats, byT, people, grand, tr, st: grand - tr, effOn, hasTiket,
    dalam: rows.filter((r) => r.dalamKota), empty: rows.filter((r) => !r.n && !r.dalamKota), miss: live.filter((r) => r.missing.length),
  };
}
const modeTxt = () => (MS.mode === 'fb' ? 'Paket rapat fullboard' : 'Tanpa paket rapat (uang harian penuh dan penginapan)');
const lamaTxt = () => `${MS.hari} hari, ${MS.malam} malam${MS.mode === 'fb' ? `, ${Math.min(MS.paket, MS.hari)} paket fullboard` : ''}`;
const lamaRow = (r) => `${r.h} h / ${r.m} m${r.p ? ` / ${r.p} pkt` : ''}`;

/* ---------------- Tampilan ---------------- */
const stp = (id, val, min, max, label, sm = false) => `<div class="stp${sm ? ' sm' : ''}" data-stp="${id}" data-min="${min}" data-max="${max}"><button type="button" data-d="-1" aria-label="Kurangi ${esc(label)}"${val <= min ? ' disabled' : ''}>−</button><input class="stp-in" type="text" inputmode="numeric" maxlength="4" value="${val}" aria-label="${esc(label)}"><button type="button" data-d="1" aria-label="Tambah ${esc(label)}"${val >= max ? ' disabled' : ''}>+</button></div>`;
const seg = (name, opts, cur) => `<div class="kp-seg" role="radiogroup">${opts.map((o) => `<button type="button" role="radio" aria-checked="${o.v === cur}" class="${o.v === cur ? 'on' : ''}" data-${name}="${o.v}">${esc(o.t)}</button>`).join('')}</div>`;
const STEPS = [['Acara', 'calendar'], ['Kota asal', 'map-pin'], ['Jumlah peserta', 'users'], ['Hasil', 'file-text']];

function stepsNav() {
  const nOrg = MS.asal.reduce((x, a) => x + sumOrg(a.org), 0);
  const st = [
    MS.ke ? `${labelOf(MS.ke)} · ${MS.hari} hari` : 'Belum diisi',
    MS.asal.length ? `${MS.asal.length} kota asal` : 'Belum dipilih',
    nOrg ? `${nOrg.toLocaleString('id-ID')} orang` : 'Belum diisi',
    'Ringkasan, PDF, Excel',
  ];
  return `<nav class="ms-steps" aria-label="Langkah">${STEPS.map(([t, i], k) => `<button type="button" class="ms-st${MS.step === k + 1 ? ' on' : ''}" data-go="${k + 1}"${MS.step === k + 1 ? ' aria-current="step"' : ''}><span class="step">${k + 1}</span><span class="ms-st-tx"><b>${t}</b><small>${esc(st[k])}</small></span></button>`).join('')}</nav>`;
}
const navBtns = (back, next, nextTxt) => `<div class="ms-nav">${back ? `<button type="button" class="btn" data-go="${back}">${ic('chevron-left')} Kembali</button>` : '<span></span>'}${next ? `<button type="button" class="btn primary" data-go="${next}">${esc(nextTxt)} ${ic('chevron-right')}</button>` : ''}</div>`;

function step1(ui) {
  const fbInfo = MS.mode === 'fb'
    ? `Hari paket memakai tarif <b>paket rapat fullboard</b> (per tingkat) ditambah <b>uang harian rapat fullboard</b>. Hari di luar paket memakai uang harian ${MS.jenis === 'diklat' ? 'diklat' : 'luar kota'}, dan malam di luar paket memakai tarif penginapan. Bawaan hari paket sama dengan jumlah malam.`
    : `Untuk kegiatan di kantor atau tempat tanpa paket rapat: uang harian ${MS.jenis === 'diklat' ? 'diklat' : 'luar kota'} penuh tiap hari, penginapan tiap malam, ditambah transportasi dari kota asal.`;
  return `<div class="card card-pad ms-card">
    <h2 class="kp-h"><span class="step">1</span>Acara</h2>
    <div class="ms-one">${ui.placeField('mKe', 'Kota tempat acara', MS.ke ? labelOf(MS.ke) : '', 'Ketik kota tujuan, mis. Surabaya, Bandung…')}</div>
    <div class="ms-f"><span class="kp-lbl">Jenis kegiatan</span>${seg('mode', [{ v: 'non', t: 'Tanpa paket rapat' }, { v: 'fb', t: 'Paket rapat fullboard' }], MS.mode)}</div>
    <div class="ms-f"><span class="kp-lbl">Uang harian</span>${seg('jenis', [{ v: 'lk', t: 'Luar kota' }, { v: 'diklat', t: 'Diklat' }], MS.jenis)}</div>
    <div class="callout ms-info">${ic('info')}<div>${fbInfo}</div></div>
    <div class="ms-days">
      <div class="ms-f"><span class="kp-lbl">Hari</span>${stp('hari', MS.hari, 1, 365, 'Jumlah hari')}</div>
      <div class="ms-f"><span class="kp-lbl">Malam ${tip('Bawaan 1 malam untuk 1 hari, lalu jumlah hari dikurangi satu (2 hari 1 malam, 3 hari 2 malam, dan seterusnya). Bisa 0 sampai sama dengan jumlah hari.')}</span>${stp('malam', MS.malam, 0, MS.hari, 'Jumlah malam')}</div>
      ${MS.mode === 'fb' ? `<div class="ms-f"><span class="kp-lbl">Hari paket ${tip('Jumlah paket fullboard per orang (1 paket = 1 hari dan 1 malam). Bawaan sama dengan jumlah malam.')}</span>${stp('paket', MS.paket, 0, MS.hari, 'Jumlah hari paket')}</div>` : ''}
    </div>
    <div class="muted small">Lama ini berlaku untuk semua kota asal. Di langkah 3, tiap kota asal bisa ditambah atau dikurangi harinya (misalnya datang sehari lebih awal).</div>
    <h3 class="ms-h3">Kelas tiket pesawat per tingkat ${tip('Hanya dipakai bila rute dari kota asal memakai tiket pesawat.')}</h3>
    <div class="ms-kelas">${TINGKAT.map((t) => `<label class="ms-kl"><span>${esc(t.n)}</span><select class="sel" data-kelas="${t.k}"><option value="eko"${MS.kelas[t.k] === 'eko' ? ' selected' : ''}>Ekonomi</option><option value="bis"${MS.kelas[t.k] === 'bis' ? ' selected' : ''}>Bisnis</option></select></label>`).join('')}</div>
    ${navBtns(0, 2, 'Pilih kota asal')}
  </div>`;
}

function selPanel() {
  if (!MS.asal.length) return `<div class="empty small">Belum ada kota asal. Cari di kolom sebelah, centang dari daftar provinsi, atau pakai tombol semua ibu kota provinsi.</div>`;
  sortAsal();
  let lastP = null;
  const out = [];
  for (const a of MS.asal) {
    const p = provOf(a.id);
    if (p !== lastP) { out.push(`<div class="ms-sel-p">${esc(S.prov[p]?.nama || '')}</div>`); lastP = p; }
    const dk = sameAsDest(a.id);
    out.push(`<span class="ms-chip${dk ? ' warn' : ''}"${dk ? ' title="Sama dengan kota acara: perjalanan dalam kota, segera hadir"' : ''}>${esc(labelOf(a.id))}${isCap(a.id) ? ' <small>ibu kota</small>' : ''}${dk ? ' <small>dalam kota</small>' : ''}<button type="button" data-rm="${esc(a.id)}" aria-label="Hapus ${esc(labelOf(a.id))}">${ic('x')}</button></span>`);
  }
  return out.join('');
}
function provBody(pid) {
  const ids = pid === 'dki' ? ['jakarta'] : W.data.places.filter((x) => x.p === pid).map((x) => x.id)
    .sort((a, b) => (isCap(b) - isCap(a)) || ((W.byId[a].t === 'kota' ? 0 : 1) - (W.byId[b].t === 'kota' ? 0 : 1)) || labelOf(a).localeCompare(labelOf(b), 'id'));
  const on = new Set(MS.asal.map((a) => a.id));
  return ids.map((id) => `<label class="ms-cb"><input type="checkbox" data-cb="${esc(id)}"${on.has(id) ? ' checked' : ''}><span>${esc(id === 'jakarta' ? 'Jakarta (seluruh kota administrasi)' : labelOf(id))}${isCap(id) && id !== 'jakarta' ? ' <small>ibu kota</small>' : ''}</span></label>`).join('');
}
const provCount = (pid) => MS.asal.filter((a) => provOf(a.id) === pid).length;
function step2(ui) {
  const caps = S.provList.map((p) => capOf(p.id));
  const allCaps = caps.every((c) => MS.asal.some((a) => a.id === c));
  return `<div class="ms-2col">
    <div class="card card-pad ms-card">
      <h2 class="kp-h"><span class="step">2</span>Kota asal peserta</h2>
      <div class="ms-one">${ui.placeField('mAsal', 'Tambah kota asal', '', 'Ketik kota/kabupaten, mis. Medan, Kab. Bojonegoro…')}</div>
      <div class="ms-quick">
        <button type="button" class="btn sm${allCaps ? ' on' : ''}" id="msCaps">${ic(allCaps ? 'check' : 'landmark')} Semua ibu kota provinsi (${caps.length})</button>
        <button type="button" class="btn sm danger" id="msClear"${MS.asal.length ? '' : ' disabled'}>${ic('x')} Kosongkan</button>
      </div>
      <div class="ms-provs">${S.provList.map((p) => {
        const c = provCount(p.id);
        return `<details class="ms-prov" data-p="${p.id}"><summary><span class="ms-pn">${esc(p.nama)}</span><span class="ms-pc${c ? ' on' : ''}">${c ? `${c} dipilih` : ''}</span><button type="button" class="btn xs" data-cap="${p.id}" title="Tambah ibu kota ${esc(p.nama)}">+ Ibu kota</button>${ic('chevron-down', 'ms-chev')}</summary><div class="ms-pb"></div></details>`;
      }).join('')}</div>
    </div>
    <div class="card card-pad ms-card ms-sel">
      <h3 class="ms-h3">Dipilih <span class="count">${MS.asal.length}</span></h3>
      <div class="ms-sel-list">${selPanel()}</div>
      ${navBtns(1, 3, 'Isi jumlah peserta')}
    </div>
  </div>`;
}

function step3() {
  if (!MS.asal.length) return `<div class="card card-pad"><div class="empty small">Pilih kota asal dulu di langkah 2.</div>${navBtns(2, 0)}</div>`;
  sortAsal();
  const sums = zeroOrg();
  for (const a of MS.asal) for (const t of TINGKAT) sums[t.k] += a.org[t.k] || 0;
  const grand = sumOrg(sums);
  const head = TINGKAT.map((t) => `<th class="n" title="${esc(t.n)}">${esc(SHORT[t.k])}</th>`).join('');
  const bulk = TINGKAT.map((t) => `<td class="n"><input class="ms-in" data-bulk="${t.k}" inputmode="numeric" maxlength="4" placeholder="–" aria-label="Isi semua ${esc(t.n)}"></td>`).join('');
  const rows = MS.asal.map((a, i) => {
    const d = daysOf(a);
    const dk = sameAsDest(a.id);
    return `<tr data-i="${i}"${dk ? ' class="dk"' : ''}>
      <th scope="row"><b>${esc(labelOf(a.id))}</b><small>${esc(S.prov[provOf(a.id)]?.nama || '')}${dk ? ' · dalam kota, belum dihitung' : ''}</small></th>
      ${TINGKAT.map((t) => `<td class="n"><input class="ms-in" data-k="${t.k}" inputmode="numeric" maxlength="4" value="${a.org[t.k] || ''}" placeholder="0" aria-label="${esc(t.n)} dari ${esc(labelOf(a.id))}"></td>`).join('')}
      <td class="ms-dh">${stp('dh:' + i, a.dh, -(MS.hari - 1), 30, 'Tambah atau kurangi hari ' + labelOf(a.id), true)}<small class="ms-dhx">${d.h} h / ${d.m} m</small></td>
      <td class="n ms-sum">${sumOrg(a.org) || '–'}</td>
      <td><button type="button" class="icon-btn sm" data-rm="${esc(a.id)}" aria-label="Hapus ${esc(labelOf(a.id))}">${ic('x')}</button></td>
    </tr>`;
  }).join('');
  return `<div class="card ms-card ms-c3">
    <div class="ms-c3-h"><h2 class="kp-h"><span class="step">3</span>Jumlah peserta per kota asal</h2>
      <div class="muted small">Ketik langsung di tabel, atau isi baris <b>Isi semua</b> lalu tekan Terapkan. Kolom ± hari menggeser hari dan malam untuk kota itu saja.</div></div>
    <div class="tbl-wrap ms-tw"><table class="t ms-t">
      <thead><tr><th>Kota asal</th>${head}<th>± hari ${tip(`Lama bawaan ${MS.hari} hari ${MS.malam} malam. Misalnya +1 untuk peserta yang berangkat sehari lebih awal: hari dan malamnya sama-sama bertambah satu.`)}</th><th class="n">Jumlah</th><th><span class="sr">Hapus</span></th></tr>
        <tr class="ms-bulk"><th>Isi semua</th>${bulk}<td colspan="3"><button type="button" class="btn sm" id="msBulk">Terapkan ke ${MS.asal.length} kota</button></td></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><th>Total</th>${TINGKAT.map((t) => `<td class="n" data-ft="${t.k}">${sums[t.k] || '–'}</td>`).join('')}<td></td><td class="n" data-ft="all">${grand.toLocaleString('id-ID')}</td><td></td></tr></tfoot>
    </table></div>
    <details class="fold ms-paste"><summary><span>${ic('copy')} Tempel dari Excel</span><small>salin kolom kota dan jumlahnya</small></summary><div class="fold-body">
      <p class="small muted">Satu baris per kota. Kolom pertama nama kota/kabupaten, lalu jumlah per tingkat berurutan: ${TINGKAT.map((t) => esc(SHORT[t.k])).join(', ')}. Kolom ke-8 (opsional) ± hari. Bila hanya ada satu angka, angka itu masuk ke tingkat
      <select class="sel sm" id="msSingle">${TINGKAT.map((t) => `<option value="${t.k}"${MS.single === t.k ? ' selected' : ''}>${esc(SHORT[t.k])}</option>`).join('')}</select>. Baris tanpa angka hanya menambah kota asal (berisi 1 pelaksana bawaan). Kota yang belum dipilih otomatis ditambahkan.</p>
      <textarea id="msPasteIn" class="ms-ta" rows="6" placeholder="Surabaya&#9;0&#9;0&#9;0&#9;1&#9;2&#9;10&#10;Kab. Bojonegoro&#9;5"></textarea>
      <div class="ms-paste-a"><button type="button" class="btn" id="msPasteGo">Proses tempelan</button></div>
      <div id="msPasteOut"></div>
    </div></details>
    <div class="ms-pad">${navBtns(2, 4, 'Lihat hasil')}</div>
  </div>`;
}

const catKeys = (res, k) => [...new Set(res.live.flatMap((r) => r.res.lines.filter((l) => l.cat === k && !l.missing).map((l) => tableKey(l.t))))];
function catRows(res) {
  return CATS.filter(([k]) => res.cats[k]).map(([k, n]) => `<tr><td>${n}</td><td class="ms-eff">${effMini(catKeys(res, k))}</td><td class="n">${fmt(res.cats[k])}</td><td class="n muted">${res.grand ? ((res.cats[k] / res.grand) * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 }) : 0}%</td></tr>`).join('');
}
function detailLines(r) {
  return `<table class="t ms-dt"><thead><tr><th>Komponen</th><th class="n">Satuan biaya</th><th>Volume</th><th class="n">Jumlah</th></tr></thead><tbody>${r.res.lines.filter((l) => l.qty || l.missing).map((l) => `<tr${l.missing ? ' class="miss"' : ''}><td>${esc(l.label)}${l.sub ? `<small>${esc(l.sub)}</small>` : ''}<a class="chip ref" href="${l.ref.href}">${esc(l.ref.label)}</a></td><td class="n">${l.unit != null ? fmt(l.unit) + (effPct(l.t) < 100 ? `<small>${pctTxt(effPct(l.t))} dari ${fmt(l.n)}</small>` : '') : '<span class="na">Tidak tercantum</span>'}</td><td>${esc(l.vol)}</td><td class="n">${l.amount != null ? fmt(l.amount) : '–'}</td></tr>`).join('')}</tbody></table>`;
}
function sorted(res) {
  const { k, d } = MS.sort;
  const rows = [...res.live];
  if (k === 'name') rows.sort((a, b) => d * labelOf(a.a.id).localeCompare(labelOf(b.a.id), 'id'));
  else if (k === 'prov') rows.sort((a, b) => d * (provOrder(a.prov) - provOrder(b.prov)) || labelOf(a.a.id).localeCompare(labelOf(b.a.id), 'id'));
  else rows.sort((a, b) => d * (a[k] - b[k]));
  return rows;
}
function step4(effNotice) {
  const res = computeAll();
  if (!res.ready) return `<div class="card card-pad"><div class="empty small">Isi kota tempat acara di langkah 1.</div>${navBtns(0, 1, 'Ke langkah 1')}</div>`;
  if (!res.live.length) return `<div class="card card-pad"><div class="empty small">Belum ada peserta yang bisa dihitung. Isi jumlah peserta di langkah 3.</div>${navBtns(3, 0)}</div>`;
  const warn = [];
  if (res.dalam.length) warn.push(`<b>${res.dalam.length} kota asal sama dengan kota acara</b> (${res.dalam.map((r) => esc(labelOf(r.a.id))).join(', ')}): perjalanan dinas dalam kota segera hadir, jadi belum dihitung.`);
  if (res.miss.length) warn.push(`<b>${res.miss.length} kota asal punya komponen yang tidak tercantum di tabel SBM</b> (${res.miss.slice(0, 8).map((r) => esc(labelOf(r.a.id))).join(', ')}${res.miss.length > 8 ? ', …' : ''}). Komponen itu mengacu harga riil dan tidak ikut dijumlahkan; lihat rinciannya di tabel.`);
  if (res.empty.length) warn.push(`${res.empty.length} kota asal belum diisi jumlah pesertanya dan dilewati.`);
  const th = (k, t, n) => `<th class="${n ? 'n ' : ''}srt${MS.sort.k === k ? ' on' : ''}" data-sort="${k}" aria-sort="${MS.sort.k === k ? (MS.sort.d > 0 ? 'ascending' : 'descending') : 'none'}"><button type="button">${t}${MS.sort.k === k ? (MS.sort.d > 0 ? ' ▲' : ' ▼') : ''}</button></th>`;
  const rows = sorted(res).map((r) => `<tr class="ms-r${r.missing.length ? ' has-miss' : ''}" data-id="${esc(r.a.id)}" tabindex="0" aria-expanded="false">
      <td data-l="Kota asal"><b>${esc(labelOf(r.a.id))}</b>${r.missing.length ? ` <span class="chip sm warn" title="Ada komponen tidak tercantum">${ic('triangle-alert')} ${r.missing.length}</span>` : ''}<small>${esc(S.prov[r.prov].nama)}</small></td>
      <td class="n" data-l="Orang">${r.n}</td>
      <td data-l="Lama">${lamaRow(r)}</td>
      <td class="n" data-l="Transportasi">${fmt(r.tr)}</td>
      <td class="n" data-l="Selama di tujuan">${fmt(r.st)}</td>
      <td class="n tot" data-l="Jumlah">${fmt(r.total)}</td>
    </tr><tr class="ms-det" hidden><td colspan="6">${detailLines(r)}</td></tr>`).join('');
  const D = res.D;
  return `${effNotice()}
  <div class="ms-top">
    <div class="card ms-tot">
      <div class="ms-tot-k">Perkiraan total</div>
      <div class="ms-tot-v">${fmt(res.grand)}</div>
      <div class="ms-tot-m">${res.people.toLocaleString('id-ID')} orang dari ${res.live.length} kota asal · rata-rata ${fmt(Math.round(res.grand / res.people))} per orang</div>
      <div class="ms-tot-m muted">${esc(labelOf(MS.ke))} (${esc(S.prov[D.prov].nama)}) · ${esc(lamaTxt())} · ${esc(modeTxt())}</div>
      <div class="ms-dl">
        <label class="ms-dl-o"><span>Halaman rincian PDF</span><select class="sel sm" id="msPdfBy"><option value="kota"${MS.pdfBy === 'kota' ? ' selected' : ''}>Satu halaman per kota asal</option><option value="prov"${MS.pdfBy === 'prov' ? ' selected' : ''}>Satu halaman per provinsi</option></select></label>
        <button type="button" class="btn primary" id="msPdf">${ic('download')} Unduh PDF</button>
        <button type="button" class="btn primary" id="msXls">${ic('file-spreadsheet')} Unduh Excel</button>
      </div>
    </div>
    <div class="card ms-cat"><table class="t ms-ct"><thead><tr><th>Komponen</th><th>Dibayar ${tip('Simulasi efisiensi per komponen. Bawaan 100%. Berlaku untuk tabel SBM komponen itu di seluruh aplikasi dan tersimpan di perangkat ini.')}</th><th class="n">Jumlah</th><th class="n">Porsi</th></tr></thead><tbody>${catRows(res)}</tbody>
      <tfoot><tr><td>Total</td><td></td><td class="n">${fmt(res.grand)}</td><td></td></tr></tfoot></table></div>
  </div>
  ${warn.length ? `<div class="callout warn ms-warn">${ic('triangle-alert')}<div>${warn.map((w) => `<p>${w}</p>`).join('')}</div></div>` : ''}
  <div class="card ms-res">
    <div class="ms-res-h"><b>Per kota asal</b><span class="muted small">Klik baris untuk melihat rinciannya. Klik judul kolom untuk mengurutkan.</span></div>
    <div class="tbl-wrap ms-rw"><table class="t ms-rt">
      <thead><tr>${th('prov', 'Kota asal')}${th('n', 'Orang', 1)}<th>Lama</th>${th('tr', 'Transportasi', 1)}${th('st', 'Selama di tujuan', 1)}${th('total', 'Jumlah', 1)}</tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td>Total</td><td class="n" data-l="Orang">${res.people.toLocaleString('id-ID')}</td><td></td><td class="n" data-l="Transportasi">${fmt(res.tr)}</td><td class="n" data-l="Selama di tujuan">${fmt(res.st)}</td><td class="n tot" data-l="Jumlah">${fmt(res.grand)}</td></tr></tfoot>
    </table></div>
    <div class="kp-foot muted small">${footNote(res)}</div>
  </div>
  ${navBtns(3, 0)}`;
}
function footNote(res) {
  const n = [`Satuan biaya mengikuti SBM TA ${Y.y} (${esc(Y.src)})${res.effOn ? ', dengan persentase dibayar yang sedang aktif' : ''}.`,
    'Transport darat dan taksi dihitung 2 kali (berangkat dan pulang); tiket pesawat memakai rute pertama yang tercantum.'];
  if (MS.mode === 'fb') n.push('Paket fullboard memakai tarif per tingkat: Menteri/Wakil Menteri untuk Pejabat Negara/Wamen; Eselon I dan II/JF Utama untuk Eselon I, Pejabat Negara Lainnya, dan Eselon II; Eselon III ke bawah untuk lainnya. Tarif SBM dihitung untuk 1 kamar berdua; indeks 1 kamar sendiri tidak diterapkan.');
  n.push('Angka ini perkiraan, bukan batas pembayaran. Cek ulang ke ketentuan aslinya.');
  return n.join(' ');
}

/* ---------------- Tempel dari Excel ---------------- */
function parsePaste(text) {
  const out = { ok: [], bad: [] };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const cells = (line.includes('\t') ? line.split('\t') : line.split(/[;,]/)).map((c) => c.trim());
    const name = cells[0];
    const nums = cells.slice(1).filter((c) => c !== '').map((c) => Number(c.replace(/\./g, '')));
    if (!name || nums.some((x) => !Number.isFinite(x))) { out.bad.push(line); continue; }
    const q = name.replace(/^kabupaten\s+/i, 'kab ').replace(/^kab\.\s*/i, 'kab ').replace(/^kota\s+adm(\.|inistrasi)?\s+/i, '');
    const hit = suggest(q, 1)[0];
    if (!hit) { out.bad.push(name); continue; }
    out.ok.push({ name, id: normId(hit.id), nums });
  }
  return out;
}
function applyPaste(p) {
  let added = 0, upd = 0;
  for (const r of p.ok) {
    if (!r.id) continue;
    if (addAsal(r.id)) added++;
    const a = MS.asal.find((x) => x.id === r.id);
    if (!r.nums.length) continue;
    a.org = zeroOrg();
    if (r.nums.length === 1) a.org[MS.single] = Math.max(0, Math.min(9999, Math.round(r.nums[0])));
    else TINGKAT.forEach((t, i) => { if (r.nums[i] != null) a.org[t.k] = Math.max(0, Math.min(9999, Math.round(r.nums[i]))); });
    if (r.nums.length >= 7) a.dh = Math.max(-(MS.hari - 1), Math.min(30, Math.round(r.nums[6])));
    upd++;
  }
  return { added, upd };
}

/* ---------------- View ---------------- */
export function viewMassal(ui) {
  const html = `<div class="page-head"><h1 class="title">Perjadin (banyak asal)</h1><p class="subtitle">Perkiraan biaya satu kegiatan di kota tertentu dengan peserta dari banyak kota asal. Hasilnya bisa diunduh sebagai PDF (ringkasan di halaman pertama, lalu rincian) dan Excel. Isian tersimpan otomatis di perangkat ini saja, tanpa akun dan tidak dikirim ke mana pun.</p></div>
  <div class="ms-bar"><span class="muted small">${ic('check')} Draf tersimpan otomatis di perangkat ini</span><button type="button" class="btn sm danger" id="msReset">${ic('history')} Reset semua</button></div>
  <div id="msNav"></div><div id="msBody"></div>`;
  const { $, $$, toast, effNotice } = ui;
  const go = (s) => { MS.step = s; save(); render(); window.scrollTo({ top: 0 }); };
  const onGo = (e) => { const b = e.target.closest('[data-go]'); if (b) go(Number(b.dataset.go)); };
  function render() {
    const nav = $('#msNav');
    nav.innerHTML = stepsNav();
    if (!nav.dataset.w) {
      nav.dataset.w = 1; nav.addEventListener('click', onGo);
      $('#msReset').onclick = () => { if (!confirmReset()) return; resetMS(); render(); window.scrollTo({ top: 0 }); toast('Semua isian dikembalikan ke awal'); };
    }
    // Elemen baru tiap render agar pendengar event langkah sebelumnya ikut terbuang
    const old = $('#msBody');
    const body = old.cloneNode(false);
    old.replaceWith(body);
    body.addEventListener('click', onGo);
    body.innerHTML = MS.step === 1 ? step1(ui) : MS.step === 2 ? step2(ui) : MS.step === 3 ? step3() : step4(effNotice);
    body.dataset.step = MS.step;
    if (MS.step === 1) wire1();
    if (MS.step === 2) wire2();
    if (MS.step === 3) wire3();
    if (MS.step === 4) wire4();
  }
  const navRefresh = () => { $('#msNav').innerHTML = stepsNav(); };
  // Stepper umum: data-stp → fungsi set
  function setStp(el, v, keepText) {
    const min = Number(el.dataset.min), max = Number(el.dataset.max);
    v = Math.max(min, Math.min(max, Number.isFinite(v) ? v : min));
    const inp = el.querySelector('input');
    if (!keepText) inp.value = v;
    el.querySelector('[data-d="-1"]').disabled = v <= min;
    el.querySelector('[data-d="1"]').disabled = v >= max;
    return v;
  }
  function wireStp(root, get, apply) {
    root.addEventListener('click', (e) => {
      const b = e.target.closest('.stp button');
      if (!b) return;
      const el = b.closest('.stp');
      apply(el, get(el.dataset.stp) + Number(b.dataset.d));
    });
    root.addEventListener('input', (e) => {
      const inp = e.target.closest('.stp-in');
      if (!inp) return;
      const neg = inp.value.trim().startsWith('-');
      inp.value = (neg ? '-' : '') + inp.value.replace(/\D/g, '');
      if (inp.value === '' || inp.value === '-') return;
      apply(inp.closest('.stp'), Number(inp.value), true);
    });
    root.addEventListener('focusout', (e) => {
      const inp = e.target.closest('.stp-in');
      if (!inp) return;
      const el = inp.closest('.stp');
      apply(el, inp.value === '' || inp.value === '-' ? get(el.dataset.stp) : Number(inp.value));
    });
    root.addEventListener('focusin', (e) => { const inp = e.target.closest('.stp-in'); if (inp) inp.select(); });
    root.addEventListener('keydown', (e) => { const inp = e.target.closest('.stp-in'); if (inp && e.key === 'Enter') inp.blur(); });
  }

  function wire1() {
    const body = $('#msBody');
    ui.attachAC('mKe', (it) => { MS.ke = it.id; save(); navRefresh(); });
    $$('[data-clear]', body).forEach((b) => b.onclick = () => { const i = $('#' + b.dataset.clear); i.value = ''; i.focus(); i.dispatchEvent(new Event('input')); });
    $$('[data-mode]', body).forEach((b) => b.onclick = () => { MS.mode = b.dataset.mode; save(); render(); });
    $$('[data-jenis]', body).forEach((b) => b.onclick = () => { MS.jenis = b.dataset.jenis; save(); render(); });
    $$('[data-kelas]', body).forEach((s) => s.onchange = () => { MS.kelas[s.dataset.kelas] = s.value; save(); });
    const el = (id) => $(`[data-stp="${id}"]`, body);
    wireStp(body, (id) => MS[id], (stpEl, v, keep) => {
      const id = stpEl.dataset.stp;
      if (id === 'hari') {
        MS.hari = setStp(stpEl, v, keep);
        el('malam').dataset.max = MS.hari;
        MS.malam = setStp(el('malam'), MS.malamManual ? Math.min(MS.malam, MS.hari) : Math.min(MS.hari, autoMalam(MS.hari)));
        if (el('paket')) { el('paket').dataset.max = MS.hari; MS.paket = setStp(el('paket'), MS.paketManual ? Math.min(MS.paket, MS.hari) : MS.malam); }
        else MS.paket = MS.paketManual ? Math.min(MS.paket, MS.hari) : MS.malam;
      } else if (id === 'malam') {
        MS.malamManual = true; MS.malam = setStp(stpEl, v, keep);
        if (!MS.paketManual) { MS.paket = MS.malam; if (el('paket')) setStp(el('paket'), MS.paket); }
      } else if (id === 'paket') { MS.paketManual = true; MS.paket = setStp(stpEl, v, keep); }
      save(); navRefresh();
    });
    if (!MS.ke) setTimeout(() => $('#mKe')?.focus(), 50);
  }
  // Konfirmasi ringan tanpa dialog bawaan peramban: tekan dua kali
  let armed = 0;
  function confirmReset() {
    if (!MS.asal.length && !MS.ke) return true;
    if (Date.now() - armed < 3000) { armed = 0; return true; }
    armed = Date.now(); toast('Tekan Reset sekali lagi untuk mengosongkan semua isian'); return false;
  }

  function wire2() {
    const body = $('#msBody');
    const refreshSel = () => {
      $('.ms-sel-list', body).innerHTML = selPanel();
      $('.ms-sel .count', body).textContent = MS.asal.length;
      $$('.ms-prov', body).forEach((d) => {
        const c = provCount(d.dataset.p); const pc = $('.ms-pc', d);
        pc.textContent = c ? `${c} dipilih` : ''; pc.classList.toggle('on', !!c);
        if (d.open) $$('[data-cb]', d).forEach((cb) => { cb.checked = MS.asal.some((a) => a.id === cb.dataset.cb); });
      });
      const caps = S.provList.map((p) => capOf(p.id));
      const all = caps.every((c) => MS.asal.some((a) => a.id === c));
      const cb = $('#msCaps'); cb.classList.toggle('on', all); cb.innerHTML = `${ic(all ? 'check' : 'landmark')} Semua ibu kota provinsi (${caps.length})`;
      $('#msClear').disabled = !MS.asal.length;
      save(); navRefresh();
    };
    ui.attachAC('mAsal', (it) => {
      const id = normId(it.id);
      const ok = addAsal(it.id);
      toast(ok ? `${labelOf(id)} ditambahkan` : `${labelOf(id)} sudah ada`);
      $('#mAsal').value = '';
      refreshSel();
    });
    $$('[data-clear]', body).forEach((b) => b.onclick = () => { const i = $('#' + b.dataset.clear); i.value = ''; i.focus(); i.dispatchEvent(new Event('input')); });
    $$('.ms-prov', body).forEach((d) => d.addEventListener('toggle', () => { if (d.open && !$('.ms-pb', d).innerHTML) $('.ms-pb', d).innerHTML = provBody(d.dataset.p); }));
    body.addEventListener('click', (e) => {
      const cap = e.target.closest('[data-cap]');
      if (cap) { e.preventDefault(); const id = capOf(cap.dataset.cap); toast(addAsal(id) ? `${labelOf(id)} ditambahkan` : `${labelOf(id)} sudah ada`); refreshSel(); return; }
      const rm = e.target.closest('[data-rm]');
      if (rm) { MS.asal = MS.asal.filter((a) => a.id !== rm.dataset.rm); refreshSel(); }
    });
    body.addEventListener('change', (e) => {
      const cb = e.target.closest('[data-cb]');
      if (!cb) return;
      if (cb.checked) addAsal(cb.dataset.cb); else MS.asal = MS.asal.filter((a) => a.id !== cb.dataset.cb);
      refreshSel();
    });
    $('#msCaps').onclick = () => {
      const caps = S.provList.map((p) => capOf(p.id));
      const all = caps.every((c) => MS.asal.some((a) => a.id === c));
      if (all) { MS.asal = MS.asal.filter((a) => !caps.includes(a.id) || sumOrg(a.org)); toast('Ibu kota yang belum diisi jumlahnya dihapus'); }
      else { let n = 0; caps.forEach((c) => { if (addAsal(c)) n++; }); toast(`${n} ibu kota ditambahkan`); }
      refreshSel();
    };
    $('#msClear').onclick = () => {
      if (Date.now() - armed < 3000) { armed = 0; MS.asal = []; refreshSel(); toast('Kota asal dikosongkan'); return; }
      armed = Date.now(); toast('Tekan Kosongkan sekali lagi untuk menghapus semua kota asal');
    };
  }

  function wire3() {
    const body = $('#msBody');
    if (!MS.asal.length) return;
    const foot = () => {
      const sums = zeroOrg();
      for (const a of MS.asal) for (const t of TINGKAT) sums[t.k] += a.org[t.k] || 0;
      TINGKAT.forEach((t) => { $(`[data-ft="${t.k}"]`, body).textContent = sums[t.k] || '–'; });
      $('[data-ft="all"]', body).textContent = sumOrg(sums).toLocaleString('id-ID');
      save(); navRefresh();
    };
    body.addEventListener('input', (e) => {
      const inp = e.target.closest('.ms-in');
      if (!inp) return;
      inp.value = inp.value.replace(/\D/g, '');
      if (!inp.dataset.k) return;
      const tr = inp.closest('tr'); const a = MS.asal[Number(tr.dataset.i)];
      a.org[inp.dataset.k] = Math.min(9999, Number(inp.value || 0));
      $('.ms-sum', tr).textContent = sumOrg(a.org) || '–';
      foot();
    });
    body.addEventListener('focusin', (e) => { const inp = e.target.closest('.ms-in'); if (inp) inp.select(); });
    // Enter/panah: pindah sel seperti spreadsheet
    body.addEventListener('keydown', (e) => {
      const inp = e.target.closest('.ms-in[data-k]');
      if (!inp) return;
      const keys = { Enter: [1, 0], ArrowDown: [1, 0], ArrowUp: [-1, 0] };
      const mv = keys[e.key];
      if (!mv) return;
      e.preventDefault();
      const tr = inp.closest('tr');
      const tgt = (mv[0] > 0 ? tr.nextElementSibling : tr.previousElementSibling)?.querySelector(`.ms-in[data-k="${inp.dataset.k}"]`);
      if (tgt) tgt.focus();
    });
    body.addEventListener('click', (e) => {
      const rm = e.target.closest('[data-rm]');
      if (rm) { MS.asal = MS.asal.filter((a) => a.id !== rm.dataset.rm); save(); render(); }
    });
    wireStp($('tbody', body), (id) => MS.asal[Number(id.slice(3))].dh, (el, v, keep) => {
      const i = Number(el.dataset.stp.slice(3));
      const a = MS.asal[i];
      a.dh = setStp(el, v, keep);
      const d = daysOf(a);
      $('.ms-dhx', el.closest('td')).textContent = `${d.h} h / ${d.m} m`;
      el.closest('td').classList.toggle('on', a.dh !== 0);
      save();
    });
    $$('.ms-dh', body).forEach((td, i) => td.classList.toggle('on', MS.asal[i].dh !== 0));
    $('#msBulk').onclick = () => {
      const vals = Object.fromEntries($$('[data-bulk]', body).filter((x) => x.value !== '').map((x) => [x.dataset.bulk, Math.min(9999, Number(x.value))]));
      if (!Object.keys(vals).length) { toast('Isi dulu angka di baris Isi semua'); return; }
      for (const a of MS.asal) Object.assign(a.org, vals);
      save(); render(); toast(`Diterapkan ke ${MS.asal.length} kota`);
    };
    $('#msSingle').onchange = (e) => { MS.single = e.target.value; save(); };
    $('#msPasteGo').onclick = () => {
      const p = parsePaste($('#msPasteIn').value);
      if (!p.ok.length && !p.bad.length) { toast('Tempelan masih kosong'); return; }
      const r = applyPaste(p);
      save(); render();
      const det = $('.ms-paste', $('#msBody')); det.open = true;
      $('#msPasteOut').innerHTML = `<div class="callout ${p.bad.length ? 'warn' : ''}">${ic(p.bad.length ? 'triangle-alert' : 'check')}<div><b>${p.ok.length} baris dikenali</b> (${r.added} kota baru, ${r.upd} diisi jumlahnya).${p.ok.length ? `<div class="small muted ms-match">${p.ok.slice(0, 12).map((x) => `${esc(x.name)} → ${esc(labelOf(x.id))}`).join('; ')}${p.ok.length > 12 ? '; …' : ''}</div>` : ''}${p.bad.length ? `<div class="small"><b>${p.bad.length} tidak dikenali:</b> ${p.bad.slice(0, 12).map(esc).join('; ')}${p.bad.length > 12 ? '; …' : ''}</div>` : ''}</div></div>`;
      toast(`${p.ok.length} baris diproses`);
    };
  }

  function wire4() {
    const body = $('#msBody');
    body.addEventListener('click', (e) => {
      const th = e.target.closest('[data-sort]');
      if (th) {
        const k = th.dataset.sort;
        MS.sort = { k, d: MS.sort.k === k ? -MS.sort.d : (k === 'prov' || k === 'name' ? 1 : -1) };
        save(); render(); return;
      }
      const tr = e.target.closest('tr.ms-r');
      if (tr && !e.target.closest('a')) toggleRow(tr);
    });
    body.addEventListener('keydown', (e) => { const tr = e.target.closest('tr.ms-r'); if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleRow(tr); } });
    const toggleRow = (tr) => { const d = tr.nextElementSibling; d.hidden = !d.hidden; tr.setAttribute('aria-expanded', String(!d.hidden)); tr.classList.toggle('open', !d.hidden); };
    const sel = $('#msPdfBy');
    if (!sel) return;
    sel.onchange = () => { MS.pdfBy = sel.value; save(); };
    const run = async (btn, fn, msg) => {
      btn.disabled = true; const old = btn.innerHTML; btn.innerHTML = `${ic('clock')} Menyiapkan…`;
      try {
        const out = await fn(computeAll());
        const a = document.createElement('a'); a.href = URL.createObjectURL(out.blob); a.download = out.name;
        document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
        toast(msg);
      } catch (err) { console.error(err); toast('Gagal membuat berkas'); } finally { btn.disabled = false; btn.innerHTML = old; }
    };
    $('#msPdf').onclick = () => run($('#msPdf'), buildPdfMassal, 'PDF diunduh');
    $('#msXls').onclick = () => run($('#msXls'), buildXlsx, 'Excel diunduh');
  }
  return { html, after: render };
}

/* ---------------- PDF ---------------- */
const fileBase = (res) => `Perkiraan-Perjadin-Banyak-Asal-${plain(labelOf(MS.ke)).replace(/[^\w]+/g, '-')}-${MS.hari}hari-TA${Y.y}`.replace(/-+/g, '-');
const kelasTxt = (res) => TINGKAT.filter((t) => res.byT[t.k]).map((t) => `${SHORT[t.k]}: ${MS.kelas[t.k] === 'bis' ? 'Bisnis' : 'Ekonomi'}`).join('; ');
const unitTxt = (l) => { if (l.n == null) return 'Tidak tercantum'; const p = effPct(l.t); return p < 100 ? `${fmt(l.unit)}\n(${pctTxt(p)} dari ${fmt(l.n)})` : fmt(l.n); };

async function buildPdfMassal(res) {
  const jsPDF = await pdfLib();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const navy = [34, 45, 99];
  const M = { left: 14, right: 14, top: 14, bottom: 16 };
  const grid = { theme: 'grid', styles: { fontSize: 8.4, cellPadding: 1.6, lineColor: [215, 219, 232], lineWidth: 0.2, textColor: [30, 34, 52], valign: 'top' }, headStyles: { fillColor: navy, textColor: 255, fontStyle: 'bold' }, footStyles: { fillColor: [255, 246, 214], textColor: navy, fontStyle: 'bold' }, margin: M };
  const rightCols = (idx) => (d) => { if (idx.includes(d.column.index)) d.cell.styles.halign = 'right'; };
  const band = () => { doc.setFillColor(...navy); doc.rect(0, 0, W, 4, 'F'); doc.setFillColor(244, 190, 22); doc.rect(0, 4, W, 1.2, 'F'); };
  const h2 = (t, y, x = 14) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...navy); doc.text(t, x, y); doc.setFont('helvetica', 'normal'); };
  const dest = `${plain(labelOf(MS.ke))} (${S.prov[res.D.prov].nama})`;

  // Halaman 1: ringkasan
  band();
  doc.setTextColor(...navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text('Perkiraan Biaya Perjalanan Dinas Kegiatan', 14, 16);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(80, 86, 110);
  doc.text(`Standar Biaya Masukan TA ${Y.y} (${Y.src})`, 14, 21.5);
  const info = [
    ['Tempat kegiatan', dest], ['Jenis kegiatan', modeTxt()], ['Lama', lamaTxt()],
    ['Uang harian', MS.jenis === 'diklat' ? 'Diklat' : 'Luar kota'],
    ['Peserta', `${res.people.toLocaleString('id-ID')} orang dari ${res.live.length} kota asal`],
  ];
  if (res.hasTiket) info.push(['Kelas tiket', kelasTxt(res)]);
  doc.autoTable({ startY: 25, body: info, theme: 'plain', styles: { fontSize: 9.2, cellPadding: 1.1, textColor: [30, 34, 52] }, columnStyles: { 0: { cellWidth: 32, fontStyle: 'bold' } }, margin: M });
  doc.setFillColor(255, 246, 214); doc.roundedRect(14, doc.lastAutoTable.finalY + 3, W - 28, 14, 2, 2, 'F');
  doc.setFontSize(9); doc.setTextColor(80, 86, 110); doc.text('Perkiraan total', 18, doc.lastAutoTable.finalY + 9);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...navy); doc.text(fmt(res.grand), W - 18, doc.lastAutoTable.finalY + 12, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(80, 86, 110);
  doc.text(`Rata-rata ${fmt(Math.round(res.grand / res.people))} per orang`, 18, doc.lastAutoTable.finalY + 14);
  let y = doc.lastAutoTable.finalY + 24;
  h2('Ringkasan per komponen', y);
  const half = (W - 28 - 6) / 2;
  doc.autoTable({ ...grid, startY: y + 2.5, tableWidth: half, margin: { ...M, right: W - 14 - half },
    head: [['Komponen', 'Jumlah']], body: CATS.filter(([k]) => res.cats[k]).map(([k, n]) => [n, fmt(res.cats[k])]),
    foot: [['Total', fmt(res.grand)]], didParseCell: rightCols([1]) });
  const yA = doc.lastAutoTable.finalY;
  h2('Peserta per tingkat', y, 14 + half + 6);
  doc.autoTable({ ...grid, startY: y + 2.5, tableWidth: half, margin: { ...M, left: 14 + half + 6 },
    head: [['Tingkat', 'Orang']], body: TINGKAT.filter((t) => res.byT[t.k]).map((t) => [t.n, res.byT[t.k].toLocaleString('id-ID')]),
    foot: [['Total', res.people.toLocaleString('id-ID')]], didParseCell: rightCols([1]) });
  y = Math.max(yA, doc.lastAutoTable.finalY) + 8;
  h2(MS.pdfBy === 'prov' ? 'Rekap per provinsi dan kota asal' : 'Rekap per kota asal', y);
  const rk = [];
  const byProv = groupProv(res.live);
  let no = 0;
  for (const g of byProv) {
    if (MS.pdfBy === 'prov') rk.push([{ content: `${g.nama} (${g.rows.length} kota, ${g.n} orang)`, colSpan: 6, styles: { fontStyle: 'bold', fillColor: [238, 241, 250], textColor: navy } }, { content: fmt(g.total), styles: { fontStyle: 'bold', fillColor: [238, 241, 250], textColor: navy, halign: 'right' } }]);
    for (const r of g.rows) rk.push([++no, plain(labelOf(r.a.id)) + (MS.pdfBy === 'prov' ? '' : `\n${S.prov[r.prov].nama}`) + (r.missing.length ? ' *' : ''), r.n, lamaRow(r), fmt(r.tr), fmt(r.st), fmt(r.total)]);
  }
  doc.autoTable({ ...grid, startY: y + 2.5, head: [['No', 'Kota asal', 'Orang', 'Lama', 'Transportasi', 'Selama di tujuan', 'Jumlah']], body: rk,
    foot: [[{ content: 'Total', colSpan: 2 }, res.people.toLocaleString('id-ID'), '', fmt(res.tr), fmt(res.st), fmt(res.grand)]],
    columnStyles: { 0: { cellWidth: 9 }, 2: { cellWidth: 14, halign: 'right' }, 3: { cellWidth: 26 }, 4: { cellWidth: 28, halign: 'right' }, 5: { cellWidth: 30, halign: 'right' }, 6: { cellWidth: 30, halign: 'right' } },
    didParseCell: (d) => { if ((d.section === 'head' || d.section === 'foot') && [2, 4, 5, 6].includes(d.column.index)) d.cell.styles.halign = 'right'; } });
  const notes = ['Satuan biaya mengikuti SBM; transport darat dan taksi dihitung 2 kali (berangkat dan pulang); tiket pesawat memakai rute pertama yang tercantum.',
    'Tiket dan taksi bersifat dapat dilampaui (acuan); uang harian, penginapan, paket rapat, dan representasi bersifat batas tertinggi.'];
  if (MS.mode === 'fb') notes.push('Paket fullboard: 1 paket per hari paket per orang, tarif per kelompok tingkat (Menteri/Wamen; Eselon I-II/JF Utama, termasuk Pejabat Negara Lainnya; Eselon III ke bawah). Tarif untuk 1 kamar berdua; indeks 1 kamar sendiri tidak diterapkan.');
  if (res.miss.length) notes.push('Tanda * : ada komponen yang tidak tercantum di tabel SBM (mengacu harga riil) dan tidak ikut dijumlahkan.');
  if (res.dalam.length) notes.push(`Tidak dihitung (dalam kota, segera hadir): ${res.dalam.map((r) => plain(labelOf(r.a.id))).join(', ')}.`);
  if (res.effOn) notes.push('Sebagian satuan biaya memakai persentase dibayar (simulasi efisiensi).');
  y = doc.lastAutoTable.finalY + 5;
  doc.setFontSize(7.8); doc.setTextColor(90, 96, 120);
  for (const n of notes) { const t = doc.splitTextToSize('- ' + n, W - 28); if (y + t.length * 3.5 > 280) { doc.addPage(); y = 16; } doc.text(t, 14, y); y += t.length * 3.5 + 0.6; }

  // Rincian
  const linesTable = (r, startY) => {
    const body = [];
    for (const g of ['Transportasi', 'Selama di tujuan']) {
      const ls = r.res.lines.filter((l) => l.g === g && (l.qty || l.missing));
      if (!ls.length) continue;
      body.push([{ content: g, colSpan: 5, styles: { fontStyle: 'bold', fillColor: [238, 241, 250], textColor: navy } }]);
      for (const l of ls) body.push([`${plain(l.label)}${l.sub ? '\n' + l.sub : ''}`, l.ref.label, unitTxt(l), l.vol, l.amount != null ? fmt(l.amount) : '-']);
    }
    doc.autoTable({ ...grid, startY, head: [['Komponen', 'Rujukan', 'Satuan biaya', 'Volume', 'Jumlah']], body,
      foot: [[{ content: `Jumlah ${plain(labelOf(r.a.id))}`, colSpan: 4 }, fmt(r.total)]],
      columnStyles: { 1: { cellWidth: 28 }, 2: { halign: 'right', cellWidth: 34 }, 3: { cellWidth: 32 }, 4: { halign: 'right', cellWidth: 28 } },
      didParseCell: (d) => { if ((d.section === 'head' || d.section === 'foot') && (d.column.index === 2 || d.column.index === 4)) d.cell.styles.halign = 'right'; if (d.section === 'foot' && d.column.index === 4) d.cell.styles.halign = 'right'; } });
  };
  const asalHead = (r, yy, big) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(big ? 13 : 10.5); doc.setTextColor(...navy);
    doc.text(`${plain(labelOf(r.a.id))} - ${plain(labelOf(MS.ke))}`, 14, yy);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.6); doc.setTextColor(80, 86, 110);
    const ppl = TINGKAT.filter((t) => r.a.org[t.k]).map((t) => `${SHORT[t.k]} ${r.a.org[t.k]}`).join(', ');
    doc.text(doc.splitTextToSize(`${S.prov[r.prov].nama} · ${r.h} hari ${r.m} malam${r.p ? `, ${r.p} paket` : ''} · ${r.n} orang (${ppl})`, W - 28), 14, yy + 4.6);
    return yy + 8;
  };
  if (MS.pdfBy === 'prov') {
    for (const g of byProv) {
      doc.addPage(); band();
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...navy);
      doc.text(`Rincian Provinsi ${g.nama}`, 14, 15);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80, 86, 110);
      doc.text(`${g.rows.length} kota asal · ${g.n} orang · jumlah ${fmt(g.total)}`, 14, 20);
      let yy = 28;
      for (const r of g.rows) {
        if (yy > 250) { doc.addPage(); band(); yy = 16; }
        yy = asalHead(r, yy, false);
        linesTable(r, yy);
        yy = doc.lastAutoTable.finalY + 8;
      }
    }
  } else {
    for (const g of byProv) for (const r of g.rows) {
      doc.addPage(); band();
      const yy = asalHead(r, 15, true);
      linesTable(r, yy + 1);
      const per = r.res.perPerson.map((p) => [`${p.n}${p.c > 1 ? ` (x ${p.c})` : ''}`, fmt(p.sum)]);
      if (per.length) doc.autoTable({ ...grid, startY: doc.lastAutoTable.finalY + 4, head: [['Per orang', 'Jumlah']], body: per, headStyles: { fillColor: [238, 241, 250], textColor: navy, fontStyle: 'bold' }, columnStyles: { 1: { halign: 'right', cellWidth: 34 } } });
    }
  }
  const pages = doc.getNumberOfPages();
  const stamp = new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(7.2); doc.setTextColor(120, 126, 150);
    doc.text(doc.splitTextToSize(`Perkiraan dari aplikasi bantu baca SBM (cek-sbm.vercel.app, oleh @ryanepwijaya), bukan dokumen resmi. Cek ulang ke ketentuan aslinya. Dibuat ${stamp}.`, W - 48), 14, 288.5);
    doc.text(`${i}/${pages}`, W - 14, 288.5, { align: 'right' });
  }
  return { blob: doc.output('blob'), name: fileBase(res) + '.pdf' };
}
function groupProv(rows) {
  const m = new Map();
  for (const r of [...rows].sort((a, b) => provOrder(a.prov) - provOrder(b.prov) || (isCap(b.a.id) - isCap(a.a.id)) || labelOf(a.a.id).localeCompare(labelOf(b.a.id), 'id'))) {
    if (!m.has(r.prov)) m.set(r.prov, { pid: r.prov, nama: S.prov[r.prov].nama, rows: [], n: 0, total: 0 });
    const g = m.get(r.prov); g.rows.push(r); g.n += r.n; g.total += r.total;
  }
  return [...m.values()];
}

/* ---------------- Excel ---------------- */
let xlsxLib = null;
async function buildXlsx(res) {
  if (!xlsxLib) xlsxLib = loadScript('vendor/xlsx.mini.min.js');
  await xlsxLib;
  const X = window.XLSX;
  const wb = X.utils.book_new();
  const money = (ws, cols, from = 0) => {
    const rg = X.utils.decode_range(ws['!ref']);
    for (let R = from; R <= rg.e.r; R++) for (const C of cols) { const c = ws[X.utils.encode_cell({ r: R, c: C })]; if (c && c.t === 'n') c.z = '#,##0'; }
  };
  const dest = `${plain(labelOf(MS.ke))} (${S.prov[res.D.prov].nama})`;
  // Ringkasan
  const r1 = [
    ['Perkiraan Biaya Perjalanan Dinas Kegiatan'], [`Standar Biaya Masukan TA ${Y.y} (${Y.src})`], [],
    ['Tempat kegiatan', dest], ['Jenis kegiatan', modeTxt()], ['Lama', lamaTxt()], ['Uang harian', MS.jenis === 'diklat' ? 'Diklat' : 'Luar kota'],
    ['Peserta', res.people], ['Kota asal', res.live.length], ...(res.hasTiket ? [['Kelas tiket', kelasTxt(res)]] : []), [],
    ['Komponen', 'Jumlah (Rp)'], ...CATS.filter(([k]) => res.cats[k]).map(([k, n]) => [n, res.cats[k]]), ['Perkiraan total', res.grand], [],
    ['Tingkat', 'Orang'], ...TINGKAT.filter((t) => res.byT[t.k]).map((t) => [t.n, res.byT[t.k]]), [],
    ['Catatan'], [footNote(res).replace(/<[^>]+>/g, '')],
    ...(res.dalam.length ? [[`Tidak dihitung (dalam kota, segera hadir): ${res.dalam.map((r) => plain(labelOf(r.a.id))).join(', ')}`]] : []),
    [`Dibuat dari cek-sbm.vercel.app (oleh @ryanepwijaya) pada ${new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}. Bukan dokumen resmi.`],
  ];
  const s1 = X.utils.aoa_to_sheet(r1);
  s1['!cols'] = [{ wch: 30 }, { wch: 60 }];
  money(s1, [1], 11);
  X.utils.book_append_sheet(wb, s1, 'Ringkasan');
  // Per kota asal
  const cats = CATS.filter(([k]) => res.cats[k]);
  const head = ['No', 'Kota asal', 'Provinsi', ...TINGKAT.map((t) => SHORT[t.k]), 'Jumlah orang', 'Hari', 'Malam', ...(MS.mode === 'fb' ? ['Paket'] : []), ...cats.map(([, n]) => n), 'Transportasi', 'Selama di tujuan', 'Jumlah', 'Catatan'];
  const body = groupProv(res.live).flatMap((g) => g.rows).map((r, i) => [i + 1, plain(labelOf(r.a.id)), S.prov[r.prov].nama, ...TINGKAT.map((t) => r.a.org[t.k] || 0), r.n, r.h, r.m, ...(MS.mode === 'fb' ? [r.p] : []), ...cats.map(([k]) => r.cats[k] || 0), r.tr, r.st, r.total, r.missing.length ? `Tidak tercantum: ${r.missing.map((l) => plain(l.label)).join('; ')}` : '']);
  const nc = head.length;
  const tot = ['', 'Total', '', ...TINGKAT.map((t) => res.byT[t.k]), res.people, '', '', ...(MS.mode === 'fb' ? [''] : []), ...cats.map(([k]) => res.cats[k]), res.tr, res.st, res.grand, ''];
  const s2 = X.utils.aoa_to_sheet([head, ...body, tot]);
  s2['!cols'] = head.map((h, i) => ({ wch: i === 0 ? 5 : i === 1 ? 28 : i === 2 ? 22 : i === nc - 1 ? 40 : Math.max(10, h.length + 2) }));
  const moneyFrom = 3 + TINGKAT.length + 3 + (MS.mode === 'fb' ? 1 : 0);
  money(s2, Array.from({ length: cats.length + 3 }, (_, i) => moneyFrom + i), 1);
  s2['!autofilter'] = { ref: X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: body.length, c: nc - 1 } }) };
  X.utils.book_append_sheet(wb, s2, 'Per kota asal');
  // Rincian
  const h3 = ['Kota asal', 'Provinsi', 'Kelompok', 'Komponen', 'Tingkat', 'Rujukan', 'Sifat', 'Satuan SBM', '% dibayar', 'Satuan dipakai', 'Volume', 'Kuantitas', 'Jumlah'];
  const b3 = [];
  for (const g of groupProv(res.live)) for (const r of g.rows) for (const l of r.res.lines.filter((x) => x.qty || x.missing)) {
    b3.push([plain(labelOf(r.a.id)), g.nama, l.g, plain(l.label), l.sub || 'Semua', l.ref.label, l.sifat === 'BT' ? 'Batas tertinggi' : 'Dapat dilampaui', l.n ?? 'Tidak tercantum', l.n != null ? effPct(l.t) : '', l.unit ?? '', l.vol, l.qty, l.amount ?? 0]);
  }
  const s3 = X.utils.aoa_to_sheet([h3, ...b3]);
  s3['!cols'] = [28, 22, 16, 40, 30, 22, 16, 14, 10, 14, 24, 10, 16].map((w) => ({ wch: w }));
  money(s3, [7, 9, 12], 1);
  s3['!autofilter'] = { ref: X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: b3.length, c: h3.length - 1 } }) };
  X.utils.book_append_sheet(wb, s3, 'Rincian');
  const out = X.write(wb, { type: 'array', bookType: 'xlsx' });
  return { blob: new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name: fileBase(res) + '.xlsx' };
}
