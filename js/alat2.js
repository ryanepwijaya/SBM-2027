// Alat hitung berbasis tabel SBM: Hitung Lembur, Hitung Pemeliharaan dan Operasional, Paket Kegiatan.
// Hanya satuan biaya SBM × volume yang diisi pengguna; aturan pemberian tidak diterapkan kecuali yang tertulis di penjelasan SBM.
// Isian tersimpan di localStorage perangkat ini.
import { S, Y, esc, fmt, store, tip, valueCols, shortCol, unitCol, UNIT, effVal, money, effMini, tableKey } from './store.js';
import { ic } from './icons.js';

const digits = (s) => String(s ?? '').replace(/\D/g, '');
const decNorm = (s) => { const t = String(s ?? '').trim(); return !t.includes(',') && /^\d+\.\d{0,2}$/.test(t) ? t.replace('.', ',') : t; };
const num = (s) => { const t = decNorm(s).replace(/\./g, '').replace(',', '.'); const v = Number(t); return Number.isFinite(v) && v > 0 ? v : 0; };
const cleanDec = (v) => decNorm(v.replace(/[^\d,.]/g, '')).replace(/\./g, '').replace(/,(?=.*,)/g, '');
const lampRef = (bid) => { const b = S.butir[bid]; return `${b.lamp === 1 ? 'Lamp. I' : 'Lamp. II'} angka ${b.no}`; };
const unitTxt = (u) => UNIT[u] || u || '';
const provSel = (id, cur) => `<select class="sel" id="${id}" aria-label="Provinsi">${S.provList.map((p) => `<option value="${p.id}"${p.id === cur ? ' selected' : ''}>${esc(p.nama)}</option>`).join('')}</select>`;
const copyBtn = (id, label) => `<button type="button" class="btn sm" id="${id}">${ic('copy')} ${label}</button>`;
const sifatChip = (bid) => { const s = S.butir[bid].sifat; return `<span class="chip ${s === 'BT' ? 'bt' : 'dl'}">${s === 'BT' ? 'Batas Tertinggi' : 'Dapat Dilampaui'}</span>`; };

// Semua angka satu tabel SBM untuk provinsi terpilih (baris per provinsi hanya yang cocok; baris nasional selalu ikut)
export function itemsOf(bid, ti, prov) {
  const t = S.butir[bid].tables[ti];
  const vc = valueCols(t);
  const uc = unitCol(t);
  const out = [];
  const groups = [];
  t.rows.forEach((r, ri) => {
    if (r.g) { groups.push(r); return; }
    if (!r.n || !r.v) return;
    // kelompok induk = grup yang kodenya awalan kode baris (urutan terdalam lebih dulu)
    const chain = groups.filter((g) => String(r.c).startsWith(String(g.c) + '.')).sort((a, b) => String(b.c).length - String(a.c).length);
    if (r.p && r.p !== prov) return;
    if ((r.cu || t.cur) === 'USD') return;
    const texts = r.v.filter((x, i) => i > 0 && !vc.includes(i) && i !== uc?.i && x && !/^(Rp)?\s*[\d.,]+$/.test(String(x).trim()) && !(r.p && x === S.prov[r.p]?.nama));
    let base = texts.join(' · '), grp = chain[0]?.g || '';
    // baris per provinsi tanpa uraian: bila ada beberapa kolom nilai, nama kolom jadi uraian di bawah judul grup
    if (!base) { if (vc.length > 1) base = ''; else { base = grp; grp = chain[1]?.g || ''; } }
    for (const ci of vc) {
      if (r.n[ci] == null) continue;
      out.push({ key: `${bid}:${ti}:${ri}:${ci}`, bid, ti, t, grp, label: [base, vc.length > 1 ? shortCol(t.cols[ci]) : ''].filter(Boolean).join(' · ') || grp, unit: unitTxt(uc ? r.v[uc.i] : ''), n: r.n[ci], code: r.c });
    }
  });
  return out;
}

/* =================== Hitung Lembur =================== */
// Lamp. I angka 22 (ASN) dan angka 30 (Non-ASN; Satpam, Pengemudi, Petugas Kebersihan, Pramubakti)
function lemburRates() {
  const pick = (bid) => {
    const t = S.butir[bid].tables[0];
    const groups = [];
    for (const r of t.rows) { if (r.g) groups.push({ g: r.g, rows: [] }); else if (r.n && groups.length) groups[groups.length - 1].rows.push(r); }
    return { t, groups };
  };
  const a = pick('L1-22'), b = pick('L1-30');
  const L = a.groups.find((g) => /lembur/i.test(g.g) && !/makan/i.test(g.g))?.rows || [];
  const M = a.groups.find((g) => /makan/i.test(g.g))?.rows || [];
  const v = (r) => (r ? r.n[valueCols(a.t)[0]] : null);
  const v2 = (r) => (r ? r.n[valueCols(b.t)[0]] : null);
  const nonAsn = b.groups[0]?.rows || [], satpam = b.groups[1]?.rows || [];
  return {
    g1: { n: 'ASN golongan I', l: v(L[0]), m: v(M[0]), bid: 'L1-22', t: a.t },
    g2: { n: 'ASN golongan II', l: v(L[1]), m: v(M[0]), bid: 'L1-22', t: a.t },
    g3: { n: 'ASN golongan III', l: v(L[2]), m: v(M[1]), bid: 'L1-22', t: a.t },
    g4: { n: 'ASN golongan IV', l: v(L[3]), m: v(M[2]), bid: 'L1-22', t: a.t },
    na: { n: 'Pegawai Non-ASN', l: v2(nonAsn[0]), m: v2(nonAsn[1]), bid: 'L1-30', t: b.t },
    sp: { n: 'Satpam, Pengemudi, Petugas Kebersihan, Pramubakti', s: 'Satpam/pengemudi/kebersihan/pramubakti', l: v2(satpam[0]), m: v2(satpam[1]), bid: 'L1-30', t: b.t },
  };
}
const newLembur = (st = 'g3') => ({ st, o: '1', h: '', j: '', lb: false });
function lemburRow(R, r) {
  const x = R[r.st] || R.g3;
  const o = Math.max(0, Math.round(num(r.o || '1'))), h = num(r.h), j = num(r.j);
  const tl = effVal(x.t, x.l), tm = effVal(x.t, x.m);
  // Hari libur kerja: uang lembur 200% dari tarif (PMK 125/PMK.05/2009 untuk PNS; Perdirjen Perbendaharaan untuk Non-ASN); uang makan tetap
  const lembur = Math.round(o * h * j * (tl || 0) * (r.lb ? 2 : 1));
  // Uang makan lembur: setelah lembur paling kurang 2 jam berturut-turut, paling banyak 1 kali per hari
  const makan = j >= 2 ? Math.round(o * h * (tm || 0)) : 0;
  return { x, o, h, j, lembur, makan, total: lembur + makan, tl, tm, lb: !!r.lb };
}
export function viewLembur(ui) {
  const R = lemburRates();
  const KEY = 'lembur';
  const D = store.get(KEY, null);
  const L = { rows: Array.isArray(D?.rows) && D.rows.length ? D.rows.map((r) => ({ ...newLembur(), ...r, st: R[r.st] ? r.st : 'g3' })) : [newLembur()] };
  const save = () => store.set(KEY, L);
  const html = `<div class="page-head"><h1 class="title">Hitung Lembur</h1><p class="subtitle">Uang lembur dan uang makan lembur sesuai SBM TA ${Y.y}: ASN per golongan (${lampRef('L1-22')}), Pegawai Non-ASN serta satpam, pengemudi, petugas kebersihan, dan pramubakti (${lampRef('L1-30')}). Uang makan lembur dihitung bila lembur paling kurang 2 jam per hari, paling banyak sekali per hari. Centang <b>Hari libur</b> untuk lembur di hari libur kerja: uang lembur dibayar 200% dari tarif, uang makan tetap. Ditampilkan tanpa PPh.</p></div>
  <div class="card iv hn lb">
    <div class="iv-bar"><div class="muted small">Satu baris bisa satu orang atau beberapa orang dengan status, hari, dan jam yang sama.</div><button type="button" class="btn sm danger" id="lbReset">${ic('history')} Reset</button></div>
    <div class="iv-grid hn-grid lb-grid" id="lbGrid" role="table" aria-label="Daftar lembur">
      <div class="iv-h" role="row"><span role="columnheader">No</span><span role="columnheader">Status</span><span role="columnheader">Orang</span><span role="columnheader">Hari lembur</span><span role="columnheader">Jam per hari</span><span role="columnheader">Hari libur ${tip('Lembur pada hari libur kerja dibayar 200% dari tarif uang lembur (PMK 125/PMK.05/2009 untuk PNS; ketentuan Dirjen Perbendaharaan untuk Non-ASN, satpam, pengemudi, petugas kebersihan, dan pramubakti). Uang makan lembur tetap paling banyak sekali per hari.')}</span><span role="columnheader" class="n">Uang lembur · uang makan</span><span role="columnheader"><span class="sr">Hapus</span></span></div>
      <div id="lbRows"></div>
    </div>
    <div class="iv-add"><button type="button" class="btn sm" id="lbAdd">${ic('plus')} Tambah baris</button><span class="muted small">${ic('command')} Tab: kolom berikutnya · Spasi: centang hari libur · Tab di kolom terakhir: baris baru</span></div>
    <div class="hn-rek" id="lbRek"></div>
    <div class="iv-tot"><div class="hn-sum" id="lbSum"></div><div class="iv-tot-a">${copyBtn('lbCopy', 'Salin total')}</div></div>
  </div>
  <div class="kp-foot muted small tx-foot">Tarif: ${Object.values(R).map((x) => `${x.s || x.n} ${fmt(x.l)}/jam, makan ${fmt(x.m)}/hari`).join('; ')}. Hari libur kerja: uang lembur 200% dari tarif.</div>`;
  const { $, $$, toast } = ui;
  const res = (x) => `<span class="hn-x"><b>${fmt(x.total)}</b><small>Lembur ${fmt(x.lembur)}${x.lb ? ' <em>200%</em>' : ''}</small><small>Makan ${fmt(x.makan)}${x.j && x.j < 2 ? ' <em>kurang 2 jam</em>' : ''}</small></span>`;
  const rowHtml = (r, i) => `<div class="iv-r hn-r lb-r" role="row" data-i="${i}">
    <span class="iv-no c-no" role="cell">${i + 1}</span>
    <span class="c-st" role="cell" data-l="Status"><select class="sel iv-in hn-st" data-f="st" aria-label="Status baris ${i + 1}">${Object.entries(R).map(([k, x]) => `<option value="${k}"${k === r.st ? ' selected' : ''}>${esc(x.s || x.n)}</option>`).join('')}</select></span>
    <span class="c-o" role="cell" data-l="Orang"><input class="iv-in" data-f="o" inputmode="numeric" autocomplete="off" value="${esc(r.o)}" aria-label="Orang baris ${i + 1}"></span>
    <span class="c-v" role="cell" data-l="Hari"><input class="iv-in" data-f="h" inputmode="decimal" autocomplete="off" value="${esc(r.h)}" placeholder="0" aria-label="Hari lembur baris ${i + 1}"></span>
    <span class="c-t" role="cell" data-l="Jam/hari"><input class="iv-in" data-f="j" inputmode="decimal" autocomplete="off" value="${esc(r.j)}" placeholder="0" aria-label="Jam per hari baris ${i + 1}"></span>
    <span class="c-lb" role="cell"><label class="lb-ck"><input type="checkbox" class="iv-in lb-in" data-f="lb"${r.lb ? ' checked' : ''} aria-label="Hari libur baris ${i + 1}"><span>Hari libur</span></label></span>
    <span class="c-j" role="cell" data-l="Hasil">${res(lemburRow(R, r))}</span>
    <span class="c-x" role="cell"><button type="button" class="icon-btn sm" data-del="${i}" tabindex="-1" aria-label="Hapus baris ${i + 1}">${ic('x')}</button></span>
  </div>`;
  const totals = () => {
    const by = {};
    let T = { o: 0, l: 0, m: 0 };
    for (const r of L.rows) { const x = lemburRow(R, r); if (!x.total) continue; const b = (by[r.st] ||= { o: 0, l: 0, m: 0 }); b.o += x.o; b.l += x.lembur; b.m += x.makan; T.o += x.o; T.l += x.lembur; T.m += x.makan; }
    $('#lbRek').innerHTML = `<div class="hn-rek-h">Rekap per status</div><div class="hn-rek-t">${Object.entries(R).map(([k, x]) => { const b = by[k] || { o: 0, l: 0, m: 0 }; return `<div class="hn-rr lb-rr${b.o ? '' : ' nil'}"><span class="hn-rn">${esc(x.s || x.n)}</span><span>${b.o} orang</span><span class="n">Lembur ${fmt(b.l)}</span><span class="n">Makan ${fmt(b.m)}</span><span class="n">${fmt(b.l + b.m)}</span></div>`; }).join('')}</div>`;
    $('#lbSum').innerHTML = `<div class="hn-sk"><span>Total</span><b class="iv-tot-v">${fmt(T.l + T.m)}</b></div><div class="hn-sk"><span>Uang lembur</span><b>${fmt(T.l)}</b></div><div class="hn-sk"><span>Uang makan lembur</span><b>${fmt(T.m)}</b></div><div class="hn-sk"><span>Orang</span><b>${T.o}</b></div>`;
    return T;
  };
  const draw = (focus) => { $('#lbRows').innerHTML = L.rows.map(rowHtml).join(''); totals(); if (focus) { const el = $(`.lb-r[data-i="${focus.i}"] [data-f="${focus.f}"]`); if (el) { el.focus(); el.select?.(); } } };
  const refresh = (i) => { const el = $(`.lb-r[data-i="${i}"]`); if (el) el.querySelector('.c-j').innerHTML = res(lemburRow(R, L.rows[i])); totals(); };
  const isEmpty = (r) => !digits(r.h) && !digits(r.j);
  const addRow = () => { L.rows.push(newLembur(L.rows[L.rows.length - 1]?.st)); save(); draw({ i: L.rows.length - 1, f: 'st' }); };
  const after = () => {
    draw();
    const g = $('#lbGrid');
    g.addEventListener('input', (e) => { const inp = e.target.closest('input.iv-in'); if (!inp || inp.type === 'checkbox') return; const i = Number(inp.closest('.lb-r').dataset.i); inp.value = inp.dataset.f === 'o' ? digits(inp.value) : cleanDec(inp.value.replace('.', ',')); L.rows[i][inp.dataset.f] = inp.value; save(); refresh(i); });
    g.addEventListener('change', (e) => {
      const c = e.target.closest('.lb-in'); if (c) { const i = Number(c.closest('.lb-r').dataset.i); L.rows[i].lb = c.checked; save(); refresh(i); return; }
      const s = e.target.closest('.hn-st'); if (!s) return; const i = Number(s.closest('.lb-r').dataset.i); L.rows[i].st = s.value; save(); refresh(i); });
    g.addEventListener('focusin', (e) => { const inp = e.target.closest('input.iv-in'); if (inp && inp.type !== 'checkbox') inp.select(); });
    g.addEventListener('focusout', (e) => { const inp = e.target.closest('[data-f="o"]'); if (inp && !digits(inp.value)) { const i = Number(inp.closest('.lb-r').dataset.i); inp.value = '1'; L.rows[i].o = '1'; save(); refresh(i); } });
    g.addEventListener('keydown', (e) => {
      const inp = e.target.closest('.iv-in'); if (!inp) return;
      const i = Number(inp.closest('.lb-r').dataset.i), f = inp.dataset.f, last = i === L.rows.length - 1;
      if (e.key === 'Tab' && !e.shiftKey && last && f === 'lb' && !isEmpty(L.rows[i])) { e.preventDefault(); addRow(); }
      if (e.key === 'Enter' && f === 'lb') { e.preventDefault(); inp.click(); return; }
      if (e.key === 'Enter') { e.preventDefault(); if (last) { if (!isEmpty(L.rows[i])) addRow(); } else draw({ i: i + 1, f }); }
    });
    g.addEventListener('click', (e) => { const d = e.target.closest('[data-del]'); if (!d) return; const i = Number(d.dataset.del); if (L.rows.length > 1) L.rows.splice(i, 1); else L.rows[0] = newLembur(); save(); draw(); });
    $('#lbAdd').onclick = addRow;
    let armed = 0;
    $('#lbReset').onclick = () => { if (totals().l && Date.now() - armed > 3000) { armed = Date.now(); toast('Tekan Reset sekali lagi untuk mengosongkan daftar'); return; } L.rows = [newLembur()]; save(); draw({ i: 0, f: 'st' }); toast('Daftar dikosongkan'); };
    $('#lbCopy').onclick = () => { const T = totals(); ui.copy(String(T.l + T.m), 'Total disalin'); };
    if (L.rows.length === 1 && isEmpty(L.rows[0])) setTimeout(() => $('.lb-r .hn-st')?.focus(), 60);
  };
  return { html, after };
}

/* ======= Tabel isian volume generik (dipakai Pemeliharaan dan Paket Kegiatan) ======= */
// sec: { k, t, icon, items, vols: [{k, t}] (default satu kolom "Volume"), months: bool, note }
function secHtml(sec, Q, months) {
  const vols = sec.vols || [{ k: 'q', t: 'Volume' }];
  let lastG = null;
  const rows = sec.items.map((it) => {
    const g = it.grp !== lastG && lastG !== null ? `<tr class="grp${it.grp ? '' : ' sep'}"><td colspan="${3 + vols.length}">${esc(it.grp)}</td></tr>` : (lastG === null && it.grp ? `<tr class="grp"><td colspan="${3 + vols.length}">${esc(it.grp)}</td></tr>` : '');
    lastG = it.grp;
    return `${g}<tr data-key="${esc(it.key)}"><td><b class="qt-l">${esc(it.label)}</b><small>${esc(it.unit)} · ${esc(lampRef(it.bid))}</small></td>
      <td class="n qt-u" data-l="Satuan biaya">${money(it.t, it.n)}</td>
      ${vols.map((v, vi) => `<td class="qt-v" data-l="${esc(v.t)}"><input class="iv-in qt-in" data-sec="${sec.k}" data-key="${esc(it.key)}" data-v="${v.k}" inputmode="decimal" autocomplete="off" value="${esc(Q[it.key]?.[v.k] || '')}" placeholder="${vi ? '1' : '0'}" aria-label="${esc(v.t)} ${esc(it.label)}"></td>`).join('')}
      <td class="n qt-a" data-l="Jumlah">–</td></tr>`;
  }).join('');
  return `<section class="card qt-card" data-sec="${sec.k}">
    <div class="qt-h"><h2>${ic(sec.icon)}<span>${esc(sec.t)}</span></h2>${effMini(sec.items.map((it) => tableKey(it.t)))}${sec.months ? `<label class="qt-m">Bulan <input class="iv-in qt-mi" data-sec="${sec.k}" inputmode="numeric" maxlength="2" value="${Math.min(12, Math.max(0, Number(months[sec.k] ?? 12) || 0))}" aria-label="Jumlah bulan ${esc(sec.t)}"> ${tip('Untuk pagu kurang dari setahun, misalnya kendaraan baru dipakai 6 bulan. Satuan biaya per tahun dikali bulan/12.')}</label>` : ''}</div>
    ${sec.note ? `<p class="qt-note muted small">${sec.note}</p>` : ''}
    <div class="tbl-wrap qt-tw"><table class="t qt" style="--qc:${2 + vols.length}"><thead><tr><th>Uraian</th><th class="n">Satuan biaya</th>${vols.map((v) => `<th>${esc(v.t)}</th>`).join('')}<th class="n">Jumlah</th></tr></thead><tbody>${rows}</tbody>
      <tfoot><tr><td colspan="${2 + vols.length}">Subtotal ${esc(sec.t.toLowerCase())}</td><td class="n qt-st">–</td></tr></tfoot></table></div>
  </section>`;
}
function secTotal(sec, Q, months) {
  const vols = sec.vols || [{ k: 'q' }];
  let s = 0;
  const per = {};
  for (const it of sec.items) {
    const q = Q[it.key] || {};
    // kolom kedua dst. yang dikosongkan dianggap 1 (mis. orang diisi, jam belum)
    const filled = vols.filter((v) => num(q[v.k]));
    const prod = filled.length && num(q[vols[0].k]) ? vols.reduce((a, v) => a * (num(q[v.k]) || 1), 1) : 0;
    const amt = Math.round((effVal(it.t, it.n) || 0) * prod * (sec.months ? (Math.min(12, Math.max(0, Number(months[sec.k] ?? 12))) / 12) : 1));
    per[it.key] = amt; s += amt;
  }
  return { s, per };
}

/* =================== Hitung Pemeliharaan dan Operasional =================== */
export function viewPemeliharaan(ui) {
  const KEY = `pemeliharaan:${Y.y}`;
  const P = { prov: 'dki', q: {}, months: {}, ...store.get(KEY, {}) };
  const save = () => store.set(KEY, P);
  const secs = () => [
    { k: 'gedung', t: 'Gedung dan bangunan', icon: 'building', months: true, vols: [{ k: 'q', t: 'Luas (m²)' }], items: itemsOf('L2-10', 0, P.prov), note: 'Pemeliharaan rutin gedung/bangunan kantor (kerusakan paling tinggi 2%), per m² per tahun.' },
    { k: 'kend', t: 'Kendaraan dinas', icon: 'car', months: true, vols: [{ k: 'q', t: 'Unit' }], items: S.butir['L2-9'].tables.flatMap((_, ti) => itemsOf('L2-9', ti, P.prov)), note: 'Sudah termasuk bahan bakar atau pengisian daya; belum termasuk pengurusan STNK.' },
    { k: 'sarana', t: 'Sarana kantor', icon: 'monitor', months: true, vols: [{ k: 'q', t: 'Banyaknya' }], items: itemsOf('L2-8', 0, P.prov), note: 'Inventaris kantor dihitung per pegawai; lainnya per unit.' },
  ];
  const html = `<div class="page-head"><h1 class="title">Hitung Pemeliharaan dan Operasional</h1><p class="subtitle">Pagu pemeliharaan gedung/bangunan (${lampRef('L2-10')}), pemeliharaan dan operasional kendaraan dinas (${lampRef('L2-9')}), dan pemeliharaan sarana kantor (${lampRef('L2-8')}) per tahun. Isi volume yang diperlukan saja; bulan bisa dikurangi untuk prorata.</p></div>
  <div class="card qt-top"><label class="kp-fld"><span>Provinsi satker</span>${provSel('pmProv', P.prov)}</label>
    <div class="qt-grand"><span>Total pagu</span><b id="pmTot">Rp0</b></div>${copyBtn('pmCopy', 'Salin total')}<button type="button" class="btn sm danger" id="pmReset">${ic('history')} Reset</button></div>
  <div id="pmHost"></div>`;
  return { html, after: () => qtWire(ui, { P, save, secs, host: '#pmHost', tot: '#pmTot', copy: '#pmCopy', reset: '#pmReset', prov: '#pmProv' }) };
}
function qtWire(ui, o) {
  const { $, $$, toast } = ui;
  const { P } = o;
  let S_ = o.secs();
  const render = () => { S_ = o.secs(); $(o.host).innerHTML = S_.map((s) => secHtml(s, P.q, P.months)).join('') + (o.extraHtml ? o.extraHtml() : ''); calc(); };
  const calc = () => {
    let grand = 0;
    for (const s of S_) {
      const { s: sub, per } = secTotal(s, P.q, P.months);
      grand += sub;
      const card = $(`.qt-card[data-sec="${s.k}"]`);
      if (!card) continue;
      $$('tr[data-key]', card).forEach((tr) => { const a = per[tr.dataset.key]; tr.querySelector('.qt-a').textContent = a ? fmt(a) : '–'; tr.classList.toggle('on', !!a); });
      card.querySelector('.qt-st').textContent = fmt(sub);
    }
    if (o.extraTotal) grand += o.extraTotal();
    $(o.tot).textContent = fmt(grand);
    return grand;
  };
  render();
  const host = $(o.host);
  host.addEventListener('input', (e) => {
    const inp = e.target.closest('.qt-in');
    if (inp) { inp.value = cleanDec(inp.value); (P.q[inp.dataset.key] ||= {})[inp.dataset.v] = inp.value; o.save(); calc(); return; }
    const m = e.target.closest('.qt-mi');
    if (m) { m.value = digits(m.value).slice(0, 2); P.months[m.dataset.sec] = m.value === '' ? 12 : Math.min(12, Number(m.value)); o.save(); calc(); return; }
    if (o.onInput) o.onInput(e, calc);
  });
  host.addEventListener('focusin', (e) => { const inp = e.target.closest('input.iv-in'); if (inp) inp.select(); });
  host.addEventListener('keydown', (e) => {
    const inp = e.target.closest('.qt-in'); if (!inp || e.key !== 'Enter') return;
    e.preventDefault();
    const all = $$('.qt-in', host); const i = all.indexOf(inp); all[i + 1]?.focus();
  });
  if (o.onChange) host.addEventListener('change', (e) => o.onChange(e, calc, render));
  if (o.prov) $(o.prov).onchange = (e) => { P.prov = e.target.value; o.save(); render(); };
  $(o.copy).onclick = () => ui.copy(String(calc()), 'Total disalin');
  let armed = 0;
  $(o.reset).onclick = () => {
    if (calc() && Date.now() - armed > 3000) { armed = Date.now(); toast('Tekan Reset sekali lagi untuk mengosongkan isian'); return; }
    P.q = {}; P.months = {}; if (o.onReset) o.onReset(); o.save(); render(); toast('Isian dikosongkan');
  };
  o.rerender = render;
  return o;
}

/* =================== Paket Kegiatan =================== */
const TIERS = ['Menteri/Wamen', 'Eselon I–II/JF Utama', 'Eselon III ke bawah'];
const TIERS_FULL = ['Menteri, setingkat menteri, dan wakil menteri', 'Pejabat Eselon I dan II/Pejabat Fungsional Utama', 'Pejabat Eselon III/Pejabat Fungsional Madya ke bawah'];
export function viewPaket(ui) {
  const KEY = `paket:${Y.y}`;
  const P = { prov: 'dki', mode: 'luar', jenis: 'biasa', q: {}, months: {}, peserta: '', rapat: '1', makan: '1', snack: '1', paket: 'fullboard', hari: '1', tier: ['', '', ''], gedung: false, ghari: '1', ...store.get(KEY, {}) };
  if (!Array.isArray(P.tier) || P.tier.length !== 3) P.tier = ['', '', ''];
  const save = () => store.set(KEY, P);
  const t36 = S.butir['L1-36'].tables[0];
  const vc36 = valueCols(t36);
  const konsRow = () => (P.jenis === 'koord' ? t36.rows.find((r) => r.n && !r.p) : t36.rows.find((r) => r.p === P.prov));
  const t29 = S.butir['L1-29'].tables[0];
  const pCol = { halfday: t29.cols.findIndex((c) => /halfday/i.test(c)), fullday: t29.cols.findIndex((c) => /fullday/i.test(c)), fullboard: t29.cols.findIndex((c) => /fullboard/i.test(c)) };
  const tiersRows = () => { const out = []; let cur = null; for (const r of t29.rows) { if (r.g && String(r.c).split('.').length === 3) { cur = []; out.push(cur); } else if (r.p && cur) cur.push(r); } return out.map((rows) => rows.find((r) => r.p === P.prov)); };
  const uhfb = () => S.butir['L1-29'].tables[1].rows.find((r) => r.v && /fullboard/i.test(r.v[1]));
  const gedungRow = () => S.butir['L2-17'].tables[0].rows.find((r) => r.p === P.prov);
  const secs = () => [{ k: 'honor', t: 'Honorarium narasumber, moderator, pembawa acara, panitia', icon: 'mic', vols: [{ k: 'o', t: 'Orang' }, { k: 'q', t: 'Jam/kali' }], items: itemsOf('L1-9', 0, P.prov), note: 'Narasumber per jam (60 menit); moderator per kali; pembawa acara dan panitia per kegiatan. Isi yang diperlukan saja.' }];
  // Bagian utama (konsumsi di kantor atau paket di luar kantor) + sewa gedung pertemuan
  const mainCalc = () => {
    const lines = [];
    const pes = num(P.peserta);
    if (P.mode === 'kantor') {
      const r = konsRow();
      if (r) {
        const mk = effVal(t36, r.n[vc36[0]]), sn = effVal(t36, r.n[vc36[1]]);
        const kali = num(P.rapat);
        lines.push({ l: `Makan · ${P.jenis === 'koord' ? 'rapat koordinasi tingkat menteri/eselon I' : 'rapat biasa, ' + S.prov[P.prov].nama}`, u: mk, v: `${pes} orang × ${kali} rapat × ${num(P.makan)} kali`, a: Math.round(mk * pes * kali * num(P.makan)) });
        lines.push({ l: 'Kudapan (snack)', u: sn, v: `${pes} orang × ${kali} rapat × ${num(P.snack)} kali`, a: Math.round(sn * pes * kali * num(P.snack)) });
      }
    } else {
      const rows = tiersRows();
      const h = num(P.hari);
      rows.forEach((r, i) => {
        const o = num(P.tier[i]);
        if (!o) return;
        const u = r ? effVal(t29, r.n[pCol[P.paket]]) : null;
        lines.push({ l: `Paket ${P.paket} · ${TIERS[i]}`, u, v: `${o} orang × ${h} ${P.paket === 'fullboard' ? 'paket' : 'hari'}`, a: u != null ? Math.round(u * o * h) : 0, miss: u == null });
      });
      if (P.paket === 'fullboard') {
        const r = uhfb(); const o = P.tier.reduce((a, x) => a + num(x), 0);
        if (r && o) { const u = effVal(S.butir['L1-29'].tables[1], r.n[3]); lines.push({ l: 'Uang harian rapat fullboard', u, v: `${o} orang × ${h} hari`, a: Math.round(u * o * h) }); }
      }
    }
    if (P.gedung) {
      const r = gedungRow();
      if (r) { const u = effVal(S.butir['L2-17'].tables[0], r.n[3]); lines.push({ l: `Sewa gedung pertemuan · ${S.prov[P.prov].nama}`, u, v: `${num(P.ghari)} hari`, a: Math.round(u * num(P.ghari)) }); }
    }
    return lines;
  };
  const seg = (name, opts, cur) => `<div class="kp-seg" role="radiogroup">${opts.map(([v, t]) => `<button type="button" role="radio" aria-checked="${v === cur}" class="${v === cur ? 'on' : ''}" data-${name}="${v}">${esc(t)}</button>`).join('')}</div>`;
  const inp = (k, label, val, w = '') => `<label class="pk-f${w}"><span>${label}</span><input class="iv-in pk-in" data-pk="${k}" inputmode="numeric" autocomplete="off" value="${esc(val)}" placeholder="0"></label>`;
  const mainHtml = () => {
    const lines = mainCalc();
    const form = P.mode === 'kantor'
      ? `<div class="pk-row">${seg('jenis', [['biasa', 'Rapat biasa'], ['koord', 'Rapat koordinasi tingkat menteri/eselon I']], P.jenis)}</div>
         <div class="pk-grid">${inp('peserta', 'Peserta (orang)', P.peserta)}${inp('rapat', 'Jumlah rapat', P.rapat)}${inp('makan', 'Makan per rapat (kali)', P.makan)}${inp('snack', 'Kudapan per rapat (kali)', P.snack)}</div>
         <p class="qt-note muted small">Konsumsi rapat diberikan untuk rapat luring paling singkat 2 jam (${lampRef('L1-36')}).</p>`
      : `<div class="pk-row">${seg('paket', [['halfday', 'Halfday'], ['fullday', 'Fullday'], ['fullboard', 'Fullboard']], P.paket)}</div>
         <div class="pk-grid">${inp('hari', P.paket === 'fullboard' ? 'Jumlah paket (hari)' : 'Hari', P.hari)}${TIERS.map((t, i) => inp('tier' + i, `<span title="${TIERS_FULL[i]}">Peserta ${t}</span>`, P.tier[i])).join('')}</div>
         <p class="qt-note muted small">Paket per orang per hari sesuai tingkat peserta (${lampRef('L1-29')})${P.paket === 'fullboard' ? '; fullboard ditambah uang harian rapat fullboard' : ''}. Tarif fullboard untuk 1 kamar berdua.</p>`;
    const rows = lines.map((l) => `<tr${l.miss ? ' class="miss"' : ''}><td><b class="qt-l">${esc(l.l)}</b></td><td class="n" data-l="Satuan biaya">${l.u != null ? fmt(l.u) : '<span class="na">Tidak tercantum</span>'}</td><td data-l="Volume">${esc(l.v)}</td><td class="n" data-l="Jumlah">${fmt(l.a)}</td></tr>`).join('');
    const sub = lines.reduce((a, l) => a + l.a, 0);
    return `<section class="card qt-card pk-main">
      <div class="qt-h"><h2>${ic(P.mode === 'kantor' ? 'coffee' : 'hotel')}<span>${P.mode === 'kantor' ? 'Konsumsi rapat di kantor' : 'Paket rapat di luar kantor'}</span></h2></div>
      <div class="pk-body">${form}
        <label class="iv-lock pk-ged"><input type="checkbox" id="pkGed"${P.gedung ? ' checked' : ''}><span>Sewa gedung pertemuan <small>(kapasitas lebih dari 300 orang, ${lampRef('L2-17')})</small></span></label>
        ${P.gedung ? `<div class="pk-grid">${inp('ghari', 'Sewa gedung (hari)', P.ghari)}</div>` : ''}</div>
      ${lines.length ? `<div class="tbl-wrap qt-tw"><table class="t qt"><thead><tr><th>Komponen</th><th class="n">Satuan biaya</th><th>Volume</th><th class="n">Jumlah</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="3">Subtotal</td><td class="n">${fmt(sub)}</td></tr></tfoot></table></div>` : '<div class="empty small">Isi jumlah peserta untuk melihat perkiraan.</div>'}
    </section>`;
  };
  const html = `<div class="page-head"><h1 class="title">Paket Kegiatan</h1><p class="subtitle">Perkiraan biaya rapat/pertemuan: konsumsi rapat di kantor atau paket halfday/fullday/fullboard di luar kantor, ditambah honorarium narasumber, moderator, pembawa acara, panitia, dan sewa gedung pertemuan bila perlu. Transport peserta dari luar kota bisa dihitung di <a href="#/massal">Perjadin (banyak asal)</a>.</p></div>
  <div class="card qt-top"><label class="kp-fld"><span>Provinsi kegiatan</span>${provSel('pkProv', P.prov)}</label>
    <div class="kp-fld"><span>Tempat</span>${seg('mode', [['kantor', 'Di kantor'], ['luar', 'Di luar kantor']], P.mode)}</div>
    <div class="qt-grand"><span>Total perkiraan</span><b id="pkTot">Rp0</b></div>${copyBtn('pkCopy', 'Salin total')}<button type="button" class="btn sm danger" id="pkReset">${ic('history')} Reset</button></div>
  <div id="pkMain"></div>
  <div id="pkHost"></div>`;
  const after = () => {
    const { $, $$ } = ui;
    let o;
    const drawMain = () => { $('#pkMain').innerHTML = mainHtml(); o && o.recalc && o.recalc(); };
    o = qtWire(ui, {
      P, save, secs, host: '#pkHost', tot: '#pkTot', copy: '#pkCopy', reset: '#pkReset', prov: null,
      extraTotal: () => mainCalc().reduce((a, l) => a + l.a, 0),
      onReset: () => Object.assign(P, { peserta: '', rapat: '1', makan: '1', snack: '1', hari: '1', tier: ['', '', ''], gedung: false, ghari: '1' }),
    });
    const recalcAll = () => { $('#pkTot').textContent = fmt(mainCalc().reduce((a, l) => a + l.a, 0) + secs().reduce((a, s) => a + secTotal(s, P.q, P.months).s, 0)); };
    o.recalc = recalcAll;
    drawMain();
    const mainEl = $('#pkMain');
    mainEl.addEventListener('input', (e) => {
      const i = e.target.closest('.pk-in'); if (!i) return;
      i.value = digits(i.value);
      const k = i.dataset.pk;
      if (k.startsWith('tier')) P.tier[Number(k.slice(4))] = i.value; else P[k] = i.value;
      save();
      // perbarui tabel tanpa kehilangan fokus kotak isian
      const pos = i.selectionStart; const key = k;
      drawMain();
      const ni = $(`.pk-in[data-pk="${key}"]`); if (ni) { ni.focus(); try { ni.setSelectionRange(pos, pos); } catch { /* abaikan */ } }
    });
    mainEl.addEventListener('focusin', (e) => { const i = e.target.closest('.pk-in'); if (i && !i._sel) { i._sel = 1; i.select(); } });
    mainEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-jenis],[data-paket]'); if (!b) return;
      if (b.dataset.jenis) P.jenis = b.dataset.jenis; else P.paket = b.dataset.paket;
      save(); drawMain();
    });
    mainEl.addEventListener('change', (e) => { if (e.target.id === 'pkGed') { P.gedung = e.target.checked; save(); drawMain(); } });
    $$('[data-mode]').forEach((b) => b.onclick = () => { P.mode = b.dataset.mode; save(); $$('[data-mode]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); }); drawMain(); });
    $('#pkProv').onchange = (e) => { P.prov = e.target.value; save(); drawMain(); o.rerender(); recalcAll(); };
    const host = $('#pkHost');
    host.addEventListener('input', () => setTimeout(recalcAll, 0));
    $('#pkReset').addEventListener('click', () => setTimeout(() => { drawMain(); recalcAll(); }, 0));
    $('#pkCopy').onclick = () => { recalcAll(); ui.copy(digits($('#pkTot').textContent), 'Total disalin'); };
    recalcAll();
  };
  return { html, after };
}
