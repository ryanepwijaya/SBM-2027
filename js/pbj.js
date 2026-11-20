// Pengadaan Barang/Jasa: Hitung Invoice (daftar barang) dan Kalkulator Pajak.
// Rumus pajak mengikuti Mesin Pengujian Tagihan (pengujian-spd): semua dibulatkan ke rupiah terdekat.
// Isian tersimpan di localStorage perangkat ini.
import { esc, fmt, store, tip } from './store.js';
import { ic } from './icons.js';

/* ---------------- Angka ---------------- */
const digits = (s) => String(s ?? '').replace(/\D/g, '');
const parseRp = (s) => Number(digits(s)) || 0;
const fmtRp = (n) => (n ? Math.round(n).toLocaleString('id-ID') : '');
// Angka desimal gaya Indonesia: 1.250,5 → 1250.5
const parseDec = (s) => { const t = String(s ?? '').trim().replace(/\./g, '').replace(',', '.'); const v = Number(t); return Number.isFinite(v) ? v : 0; };
const fmtDec = (n) => (n || n === 0 ? n.toLocaleString('id-ID', { maximumFractionDigits: 4 }) : '');
// Format ribuan saat mengetik tanpa membuat kursor melompat
function liveRp(inp) {
  const pos = inp.selectionStart ?? inp.value.length;
  const before = digits(inp.value.slice(0, pos)).length;
  const out = fmtRp(parseRp(inp.value));
  inp.value = out;
  let i = 0, seen = 0;
  while (i < out.length && seen < before) { if (/\d/.test(out[i])) seen++; i++; }
  try { inp.setSelectionRange(i, i); } catch { /* abaikan */ }
}
const cleanDec = (inp) => { inp.value = inp.value.replace(/[^\d,]/g, '').replace(/,(?=.*,)/g, ''); };

/* ---------------- Invoice ---------------- */
const INV_KEY = 'invoice';
const newRow = () => ({ v: '', h: '', f: '1' });
function loadInv() {
  const d = store.get(INV_KEY, null);
  const rows = Array.isArray(d?.rows) && d.rows.length ? d.rows.map((r) => ({ v: String(r.v ?? ''), h: String(r.h ?? ''), f: String(r.f ?? '1') })) : [newRow()];
  const ord = Array.isArray(d?.order) && d.order.length === 3 && ['v', 'h', 'f'].every((k) => d.order.includes(k)) ? d.order : ['v', 'h', 'f'];
  return { rows, lock: !!d?.lock, order: ord };
}
// Kolom isian yang urutannya bisa digeser mengikuti format invoice yang diterima
const COLS = {
  v: { t: 'Vol', w: '130px' },
  h: { t: 'Harga satuan (Rp)', s: 'Harga satuan', w: 'minmax(170px, 1fr)' },
  f: { t: 'Frek', w: '100px' },
};
const saveInv = (I) => store.set(INV_KEY, I);
const rowJumlah = (r, lock) => Math.round(parseDec(r.v) * parseRp(r.h) * (lock ? 1 : parseDec(r.f || '1')));
export function invoiceTotal(I = loadInv()) { return I.rows.reduce((a, r) => a + rowJumlah(r, I.lock), 0); }

export function viewInvoice(ui) {
  const I = loadInv();
  const html = `<div class="page-head"><h1 class="title">Hitung Invoice Barang/Jasa</h1><p class="subtitle">Isi daftar barang/jasa: volume, harga satuan, dan frekuensi. Urutan kolom bisa digeser mengikuti format invoice yang diterima. Semua bisa diisi tanpa mouse: tekan Tab untuk pindah kolom, dan Tab di kolom terakhir baris terakhir membuat baris baru. Totalnya bisa langsung dihitung pajaknya. Isian tersimpan di perangkat ini.</p></div>
  <div class="card iv">
    <div class="iv-bar">
      <label class="iv-lock"><input type="checkbox" id="ivLock"${I.lock ? ' checked' : ''}><span>Kunci semua frekuensi = 1 <small>(kolom Frek dilewati saat Tab)</small></span></label>
      <button type="button" class="btn sm" id="ivReset">${ic('history')} Reset</button>
    </div>
    <div class="iv-ord" id="ivOrd"></div>
    <div class="iv-grid${I.lock ? ' locked' : ''}" id="ivGrid" role="table" aria-label="Daftar barang/jasa">
      <div class="iv-h" role="row" id="ivHead"></div>
      <div id="ivRows"></div>
    </div>
    <div class="iv-add"><button type="button" class="btn sm" id="ivAdd">${ic('plus')} Tambah baris</button><span class="muted small">${ic('command')} Tab: kolom berikutnya · Enter: baris berikutnya · Shift+Tab: mundur</span></div>
    <div class="iv-tot">
      <div><div class="iv-tot-k">Total</div><div class="iv-tot-v" id="ivTot">Rp0</div><div class="muted small" id="ivMeta"></div></div>
      <div class="iv-tot-a"><button type="button" class="btn" id="ivCopy">${ic('copy')} Salin total</button><button type="button" class="btn primary" id="ivPajak">${ic('percent')} Hitung pajak ${ic('arrow-right')}</button></div>
    </div>
  </div>`;
  const { $, $$, toast } = ui;
  const cell = (r, i, k) => k === 'v'
    ? `<span class="c-v" role="cell" data-l="Vol"><input class="iv-in" data-f="v" inputmode="decimal" autocomplete="off" value="${esc(r.v)}" placeholder="0" aria-label="Volume baris ${i + 1}"></span>`
    : k === 'h'
      ? `<span class="c-h" role="cell" data-l="Harga satuan"><span class="iv-rp"><b>Rp</b><input class="iv-in" data-f="h" inputmode="numeric" autocomplete="off" value="${esc(r.h)}" placeholder="0" aria-label="Harga satuan baris ${i + 1}"></span></span>`
      : `<span class="c-f" role="cell" data-l="Frek"><input class="iv-in" data-f="f" inputmode="decimal" autocomplete="off" value="${I.lock ? '1' : esc(r.f)}" aria-label="Frekuensi baris ${i + 1}"${I.lock ? ' tabindex="-1" readonly' : ''}></span>`;
  const rowHtml = (r, i) => `<div class="iv-r" role="row" data-i="${i}">
      <span class="iv-no c-no" role="cell">${i + 1}</span>
      ${I.order.map((k, j) => cell(r, i, k).replace('role="cell"', `role="cell" data-p="${j}"`)).join('')}
      <span class="iv-j n c-j" role="cell" data-l="Jumlah">${fmt(rowJumlah(r, I.lock))}</span>
      <span class="c-x" role="cell"><button type="button" class="icon-btn sm" data-del="${i}" tabindex="-1" aria-label="Hapus baris ${i + 1}">${ic('x')}</button></span>
    </div>`;
  const mvBtns = (k, j) => `<span class="iv-mv"><button type="button" data-mv="${k}" data-d="-1" aria-label="Geser ${COLS[k].t} ke kiri"${j === 0 ? ' disabled' : ''}>${ic('chevron-left')}</button><button type="button" data-mv="${k}" data-d="1" aria-label="Geser ${COLS[k].t} ke kanan"${j === 2 ? ' disabled' : ''}>${ic('chevron-right')}</button></span>`;
  function drawHead() {
    $('#ivGrid').style.setProperty('--ivcols', `44px ${I.order.map((k) => COLS[k].w).join(' ')} minmax(140px, 180px) 40px`);
    $('#ivHead').innerHTML = `<span role="columnheader">No</span>${I.order.map((k, j) => `<span role="columnheader" class="iv-hc" draggable="true" data-col="${k}" title="Seret untuk menggeser kolom">${ic('grip-vertical', 'iv-grip')}<span>${COLS[k].t}</span>${mvBtns(k, j)}</span>`).join('')}<span role="columnheader" class="n">Jumlah</span><span role="columnheader"><span class="sr">Hapus</span></span>`;
    $('#ivOrd').innerHTML = `<span class="muted small">Urutan kolom</span>${I.order.map((k, j) => `<span class="iv-oc">${esc(COLS[k].s || COLS[k].t)}${mvBtns(k, j)}</span>`).join('')}`;
  }
  function moveCol(k, to) {
    const from = I.order.indexOf(k);
    if (from < 0 || to < 0 || to > 2 || from === to) return;
    I.order.splice(from, 1); I.order.splice(to, 0, k);
    saveInv(I); drawHead(); drawRows();
    ui.toast(`Urutan kolom: ${I.order.map((x) => COLS[x].s || COLS[x].t).join(', ')}`);
  }
  function drawRows(focus) {
    if (!$('#ivHead').innerHTML) drawHead();
    $('#ivRows').innerHTML = I.rows.map(rowHtml).join('');
    $('#ivGrid').classList.toggle('locked', I.lock);
    totals();
    if (focus) { const el = $(`.iv-r[data-i="${focus.i}"] [data-f="${focus.f}"]`); if (el) { el.focus(); el.select(); } }
  }
  function totals() {
    const t = invoiceTotal(I);
    const filled = I.rows.filter((r) => parseDec(r.v) && parseRp(r.h)).length;
    $('#ivTot').textContent = fmt(t);
    $('#ivMeta').textContent = `${filled} baris terisi`;
    $('#ivPajak').disabled = !t;
  }
  const active = () => I.order.filter((k) => !(I.lock && k === 'f'));
  const lastField = () => active()[active().length - 1];
  const firstField = () => active()[0];
  const sameOrFirst = (f) => (active().includes(f) ? f : firstField());
  const isEmpty = (r) => !digits(r.v) && !digits(r.h);
  function addRow(focusF) { I.rows.push(newRow()); saveInv(I); drawRows({ i: I.rows.length - 1, f: focusF || firstField() }); }
  const after = () => {
    drawRows();
    const grid = $('#ivGrid');
    grid.addEventListener('input', (e) => {
      const inp = e.target.closest('.iv-in');
      if (!inp) return;
      const i = Number(inp.closest('.iv-r').dataset.i), f = inp.dataset.f;
      if (f === 'h') liveRp(inp); else cleanDec(inp);
      I.rows[i][f] = inp.value;
      inp.closest('.iv-r').querySelector('.iv-j').textContent = fmt(rowJumlah(I.rows[i], I.lock));
      saveInv(I); totals();
    });
    grid.addEventListener('focusin', (e) => { const inp = e.target.closest('.iv-in'); if (inp && !inp.readOnly) inp.select(); });
    grid.addEventListener('keydown', (e) => {
      const inp = e.target.closest('.iv-in');
      if (!inp) return;
      const i = Number(inp.closest('.iv-r').dataset.i), f = inp.dataset.f;
      const last = i === I.rows.length - 1;
      // Tab di kolom terakhir baris terakhir → baris baru (kecuali baris itu masih kosong: Tab keluar ke tombol)
      if (e.key === 'Tab' && !e.shiftKey && last && f === lastField() && !isEmpty(I.rows[i])) { e.preventDefault(); addRow(); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (last) { if (!isEmpty(I.rows[i])) addRow(sameOrFirst(f)); else $('#ivPajak').focus(); }
        else drawRows({ i: i + 1, f: sameOrFirst(f) });
      }
      if (e.key === 'ArrowDown' && !last) { e.preventDefault(); drawRows({ i: i + 1, f }); }
      if (e.key === 'ArrowUp' && i > 0) { e.preventDefault(); drawRows({ i: i - 1, f }); }
    });
    grid.addEventListener('focusout', (e) => {
      const inp = e.target.closest('.iv-in[data-f="v"], .iv-in[data-f="f"]');
      if (!inp) return;
      const i = Number(inp.closest('.iv-r').dataset.i);
      if (inp.dataset.f === 'f' && inp.value.trim() === '') { inp.value = '1'; I.rows[i].f = '1'; saveInv(I); totals(); }
    });
    grid.addEventListener('click', (e) => {
      const d = e.target.closest('[data-del]');
      if (!d) return;
      const i = Number(d.dataset.del);
      if (I.rows.length > 1) I.rows.splice(i, 1); else I.rows[0] = newRow();
      saveInv(I); drawRows();
    });
    // Geser kolom: tombol panah (header dan bar HP) atau seret judul kolom (PC)
    const card = $('.iv');
    card.addEventListener('click', (e) => {
      const b = e.target.closest('[data-mv]');
      if (!b) return;
      e.preventDefault();
      const k = b.dataset.mv;
      moveCol(k, I.order.indexOf(k) + Number(b.dataset.d));
    });
    let dragK = null;
    const head = $('#ivHead');
    head.addEventListener('dragstart', (e) => { const h = e.target.closest('[data-col]'); if (!h) return; dragK = h.dataset.col; h.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragK); } catch { /* abaikan */ } });
    head.addEventListener('dragover', (e) => { const h = e.target.closest('[data-col]'); if (!h || !dragK) return; e.preventDefault(); $$('.iv-hc', head).forEach((x) => x.classList.toggle('over', x === h && x.dataset.col !== dragK)); });
    head.addEventListener('dragleave', (e) => { const h = e.target.closest('[data-col]'); if (h && !h.contains(e.relatedTarget)) h.classList.remove('over'); });
    head.addEventListener('drop', (e) => { const h = e.target.closest('[data-col]'); if (!h || !dragK) return; e.preventDefault(); const k = dragK; dragK = null; moveCol(k, I.order.indexOf(h.dataset.col)); });
    head.addEventListener('dragend', () => { dragK = null; $$('.iv-hc', head).forEach((x) => x.classList.remove('drag', 'over')); });
    $('#ivLock').onchange = (e) => { I.lock = e.target.checked; saveInv(I); drawRows(); toast(I.lock ? 'Frekuensi dikunci 1 dan dilewati saat Tab' : 'Frekuensi bisa diisi per baris'); };
    $('#ivAdd').onclick = () => addRow();
    let armed = 0;
    $('#ivReset').onclick = () => {
      if (invoiceTotal(I) && Date.now() - armed > 3000) { armed = Date.now(); toast('Tekan Reset sekali lagi untuk mengosongkan daftar'); return; }
      I.rows = [newRow()]; saveInv(I); drawRows({ i: 0, f: firstField() }); toast('Daftar dikosongkan');
    };
    $('#ivCopy').onclick = () => ui.copy(String(invoiceTotal(I)), 'Total disalin');
    $('#ivPajak').onclick = () => { const t = invoiceTotal(I); if (t) location.hash = `#/alat/pajak?n=${t}&dari=invoice`; };
    if (I.rows.length === 1 && isEmpty(I.rows[0])) setTimeout(() => $(`.iv-in[data-f="${firstField()}"]`)?.focus(), 60);
  };
  return { html, after };
}

/* ---------------- Hitung Honorarium ---------------- */
// Tarif PPh 21: PNS/PPPK final sesuai golongan; Non-PNS 50% × tarif Pasal 17 lapisan pertama = 2,5%
export const STATUS = {
  np: { n: 'Non-PNS', r: 0.025, fin: false },
  g12: { n: 'PNS/PPPK gol. I/II', r: 0, fin: true },
  g3: { n: 'PNS/PPPK gol. III', r: 0.05, fin: true },
  g4: { n: 'PNS/PPPK gol. IV/pejabat negara', r: 0.15, fin: true },
};
const pctS = (r) => String(Math.round(r * 1000) / 10).replace('.', ',') + '%';
const HON_KEY = 'honor';
const newHon = (st = 'np') => ({ st, o: '1', v: '', t: '' });
function loadHon() {
  const d = store.get(HON_KEY, null);
  const rows = Array.isArray(d?.rows) && d.rows.length ? d.rows.map((r) => ({ ...newHon(), ...r, st: STATUS[r.st] ? r.st : 'np' })) : [newHon()];
  return { rows, netto: !!d?.netto };
}
const saveHon = (H) => store.set(HON_KEY, H);
// Per orang dulu (dibulatkan), lalu dikali jumlah orang
function honRow(r, netto) {
  const st = STATUS[r.st] || STATUS.np;
  const o = Math.max(0, Math.round(parseDec(r.o || '1')));
  const base = Math.round(parseDec(r.v) * parseRp(r.t));
  let bruto1, pph1, net1;
  if (netto) { net1 = base; bruto1 = st.r ? Math.round(base / (1 - st.r)) : base; pph1 = bruto1 - net1; }
  else { bruto1 = base; pph1 = Math.round(base * st.r); net1 = bruto1 - pph1; }
  return { st, o, bruto: bruto1 * o, pph: pph1 * o, netto: net1 * o };
}
export function honorTotals(H = loadHon()) {
  const by = Object.fromEntries(Object.keys(STATUS).map((k) => [k, { o: 0, bruto: 0, pph: 0, netto: 0 }]));
  for (const r of H.rows) { const x = honRow(r, H.netto); const b = by[r.st] || by.np; if (!x.bruto && !x.o) continue; if (x.bruto) { b.o += x.o; b.bruto += x.bruto; b.pph += x.pph; b.netto += x.netto; } }
  const sum = (k) => Object.values(by).reduce((a, b) => a + b[k], 0);
  return { by, bruto: sum('bruto'), pph: sum('pph'), netto: sum('netto'), o: sum('o'), fin: by.g12.pph + by.g3.pph + by.g4.pph, nonfin: by.np.pph };
}

export function viewHonor(ui) {
  const H = loadHon();
  const html = `<div class="page-head"><h1 class="title">Hitung Honorarium</h1><p class="subtitle">Honorarium narasumber, moderator, panitia, dan kegiatan lain. Satu baris bisa satu orang atau beberapa orang dengan status yang sama. PPh 21 dihitung otomatis dari status: PNS/PPPK final sesuai golongan (0%, 5%, 15%), Non-PNS 2,5%. Bisa diisi tanpa mouse dengan Tab. Isian tersimpan di perangkat ini.</p></div>
  <div class="card iv hn">
    <div class="iv-bar">
      <div class="pb-opts"><label class="iv-lock"><input type="checkbox" id="hnNet"${H.netto ? ' checked' : ''}><span>Tarif yang diisi adalah netto <small>(dihitung balik ke bruto)</small></span></label></div>
      <button type="button" class="btn sm" id="hnReset">${ic('history')} Reset</button>
    </div>
    <div class="iv-grid hn-grid" id="hnGrid" role="table" aria-label="Daftar honorarium">
      <div class="iv-h hn-h" role="row"><span role="columnheader">No</span><span role="columnheader">Status</span><span role="columnheader">Orang</span><span role="columnheader">Vol</span><span role="columnheader" id="hnTh"></span><span role="columnheader" class="n">Bruto · PPh 21 · Netto</span><span role="columnheader"><span class="sr">Hapus</span></span></div>
      <div id="hnRows"></div>
    </div>
    <div class="iv-add"><button type="button" class="btn sm" id="hnAdd">${ic('plus')} Tambah baris</button><span class="muted small">${ic('command')} Tab: kolom berikutnya · Tab di kolom terakhir: baris baru · Enter: baris berikutnya</span></div>
    <div class="hn-rek" id="hnRek"></div>
    <div class="iv-tot hn-tot">
      <div class="hn-sum" id="hnSum"></div>
      <div class="iv-tot-a"><button type="button" class="btn" id="hnCopy">${ic('copy')} Salin total bruto</button><button type="button" class="btn" id="hnCopyN">${ic('copy')} Salin total netto</button></div>
    </div>
  </div>`;
  const { $, $$, toast } = ui;
  const resCell = (x) => `<span class="hn-x"><b>${fmt(x.bruto)}</b><small>PPh ${fmt(x.pph)} <em>${pctS(x.st.r)}${x.st.fin ? ' final' : ''}</em></small><small>Netto ${fmt(x.netto)}</small></span>`;
  const rowHtml = (r, i) => {
    const x = honRow(r, H.netto);
    return `<div class="iv-r hn-r" role="row" data-i="${i}">
      <span class="iv-no c-no" role="cell">${i + 1}</span>
      <span class="c-st" role="cell" data-l="Status"><select class="sel iv-in hn-st" data-f="st" aria-label="Status baris ${i + 1}">${Object.entries(STATUS).map(([k, s]) => `<option value="${k}"${k === r.st ? ' selected' : ''}>${s.n} · ${pctS(s.r)}</option>`).join('')}</select></span>
      <span class="c-o" role="cell" data-l="Orang"><input class="iv-in" data-f="o" inputmode="numeric" autocomplete="off" value="${esc(r.o)}" aria-label="Jumlah orang baris ${i + 1}"></span>
      <span class="c-v" role="cell" data-l="Vol"><input class="iv-in" data-f="v" inputmode="decimal" autocomplete="off" value="${esc(r.v)}" placeholder="0" aria-label="Volume baris ${i + 1}"></span>
      <span class="c-t" role="cell" data-l="${H.netto ? 'Tarif netto' : 'Tarif'}"><span class="iv-rp"><b>Rp</b><input class="iv-in" data-f="t" inputmode="numeric" autocomplete="off" value="${esc(r.t)}" placeholder="0" aria-label="Tarif baris ${i + 1}"></span></span>
      <span class="c-j" role="cell" data-l="Hasil">${resCell(x)}</span>
      <span class="c-x" role="cell"><button type="button" class="icon-btn sm" data-del="${i}" tabindex="-1" aria-label="Hapus baris ${i + 1}">${ic('x')}</button></span>
    </div>`;
  };
  function totals() {
    const T = honorTotals(H);
    $('#hnRek').innerHTML = `<div class="hn-rek-h">Rekap per status</div><div class="hn-rek-t">${Object.entries(STATUS).map(([k, s]) => { const b = T.by[k]; return `<div class="hn-rr${b.o ? '' : ' nil'}"><span class="hn-rn">${s.n} <em>${pctS(s.r)}${s.fin ? ' final' : ''}</em></span><span>${b.o} orang</span><span class="n">${fmt(b.bruto)}</span><span class="n">PPh ${fmt(b.pph)}</span><span class="n">Netto ${fmt(b.netto)}</span></div>`; }).join('')}</div>`;
    $('#hnSum').innerHTML = `<div class="hn-sk"><span>Total bruto</span><b class="iv-tot-v">${fmt(T.bruto)}</b></div><div class="hn-sk"><span>PPh 21 final (PNS/PPPK)</span><b>${fmt(T.fin)}</b></div><div class="hn-sk"><span>PPh 21 tidak final (Non-PNS)</span><b>${fmt(T.nonfin)}</b></div><div class="hn-sk"><span>Total netto diterima</span><b>${fmt(T.netto)}</b></div>`;
  }
  const refreshRow = (i) => {
    const el = $(`.hn-r[data-i="${i}"]`); if (!el) return;
    const r = H.rows[i]; const x = honRow(r, H.netto);
    el.querySelector('.c-j').innerHTML = resCell(x);
  };
  function drawRows(focus) {
    $('#hnTh').textContent = H.netto ? 'Tarif netto (Rp)' : 'Tarif (Rp)';
    $('#hnRows').innerHTML = H.rows.map(rowHtml).join('');
    totals();
    if (focus) { const el = $(`.hn-r[data-i="${focus.i}"] [data-f="${focus.f}"]`); if (el) { el.focus(); if (el.select) el.select(); } }
  }
  const isEmpty = (r) => !digits(r.v) && !digits(r.t);
  const addRow = () => { H.rows.push(newHon(H.rows[H.rows.length - 1]?.st || 'np')); saveHon(H); drawRows({ i: H.rows.length - 1, f: 'st' }); };
  const after = () => {
    drawRows();
    const grid = $('#hnGrid');
    grid.addEventListener('input', (e) => {
      const inp = e.target.closest('.iv-in'); if (!inp) return;
      const i = Number(inp.closest('.hn-r').dataset.i); const f = inp.dataset.f;
      if (f === 't') liveRp(inp); else if (f === 'o') inp.value = digits(inp.value); else if (f === 'v') cleanDec(inp);
      H.rows[i][f] = inp.value;
      saveHon(H); refreshRow(i); totals();
    });
    grid.addEventListener('change', (e) => {
      const sel = e.target.closest('.hn-st'); if (!sel) return;
      const i = Number(sel.closest('.hn-r').dataset.i); H.rows[i].st = sel.value; saveHon(H); refreshRow(i); totals();
    });
    grid.addEventListener('focusin', (e) => { const inp = e.target.closest('input.iv-in'); if (inp) inp.select(); });
    grid.addEventListener('focusout', (e) => { const inp = e.target.closest('[data-f="o"]'); if (inp && !digits(inp.value)) { inp.value = '1'; const i = Number(inp.closest('.hn-r').dataset.i); H.rows[i].o = '1'; saveHon(H); refreshRow(i); totals(); } });
    grid.addEventListener('keydown', (e) => {
      const inp = e.target.closest('.iv-in'); if (!inp) return;
      const i = Number(inp.closest('.hn-r').dataset.i), f = inp.dataset.f; const last = i === H.rows.length - 1;
      if (e.key === 'Tab' && !e.shiftKey && last && f === 't' && !isEmpty(H.rows[i])) { e.preventDefault(); addRow(); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (last) { if (!isEmpty(H.rows[i])) addRow(); else $('#hnCopy').focus(); } else drawRows({ i: i + 1, f });
      }
    });
    grid.addEventListener('click', (e) => {
      const d = e.target.closest('[data-del]'); if (!d) return;
      const i = Number(d.dataset.del); if (H.rows.length > 1) H.rows.splice(i, 1); else H.rows[0] = newHon(); saveHon(H); drawRows();
    });
    $('#hnNet').onchange = (e) => { H.netto = e.target.checked; saveHon(H); drawRows(); toast(H.netto ? 'Tarif dianggap netto; bruto dihitung balik' : 'Tarif dianggap bruto'); };
    $('#hnAdd').onclick = addRow;
    let armed = 0;
    $('#hnReset').onclick = () => {
      if (honorTotals(H).bruto && Date.now() - armed > 3000) { armed = Date.now(); toast('Tekan Reset sekali lagi untuk mengosongkan daftar'); return; }
      H.rows = [newHon()]; saveHon(H); drawRows({ i: 0, f: 'st' }); toast('Daftar dikosongkan');
    };
    $('#hnCopy').onclick = () => ui.copy(String(honorTotals(H).bruto), 'Total bruto disalin');
    $('#hnCopyN').onclick = () => ui.copy(String(honorTotals(H).netto), 'Total netto disalin');
    if (H.rows.length === 1 && isEmpty(H.rows[0])) setTimeout(() => $('.hn-st')?.focus(), 60);
  };
  return { html, after };
}

/* ---------------- Kalkulator Pajak ---------------- */
// Kelompok pajak; d = keterangan singkat jenis pajak (ringkasan, cek ke ketentuan yang berlaku)
const TAX = [
  { k: 'ppn', t: 'Pajak Pertambahan Nilai (PPN)', i: 'receipt', rows: [
    { k: 'dpp', n: 'DPP PPN', d: 'Dasar pengenaan pajak dengan nilai lain, 11/12 dari nilai', f: 'N × 11/12', c: (N) => Math.round(N * 11 / 12) },
    { k: 'ppn', n: 'PPN', d: 'Dipungut bendahara selaku pemungut PPN atas penyerahan barang/jasa kena pajak', f: 'DPP PPN × 12%', c: (N, R) => Math.round(R.dpp * 0.12) },
    { k: 'ppn1', n: 'PPN 1%', d: 'Sepersepuluh dari PPN', f: 'PPN × 10%', c: (N, R) => Math.round(R.ppn * 0.10) },
    { k: 'ppn12', n: 'PPN 12%', d: 'Tarif 12% langsung dari nilai, tanpa DPP nilai lain', f: 'N × 12%', c: (N) => Math.round(N * 0.12) },
  ], total: { n: 'Total nilai', d: 'Nilai ditambah PPN', f: 'N + PPN' } },
  { k: 'pot', t: 'Pajak pemotongan dan pemungutan', i: 'hand-coins', rows: [
    { k: 'pph22', n: 'PPh 22', d: 'Dipungut bendahara atas pembayaran pembelian barang', f: 'N × 1,5%', c: (N) => Math.round(N * 0.015) },
    { k: 'pph23', n: 'PPh 23', d: 'Dipotong atas imbalan jasa dan sewa harta selain tanah/bangunan', f: 'N × 2%', c: (N) => Math.round(N * 0.02) },
    { k: 'pph42', n: 'PPh 4(2) UMKM', d: 'PPh final bagi penyedia UMKM yang memiliki surat keterangan', f: 'N × 0,5%', c: (N) => Math.round(N * 0.005) },
    { k: 'pph42n', n: 'PPh 4(2) non-UMKM', sel: true, c: (N, R, S) => Math.round(N * P42N[S.p42n].r) },
    { k: 'pnbp', n: 'PNBP 0,3%', d: 'Penerimaan negara bukan pajak, bukan PPh', f: 'N × 0,3%', c: (N) => Math.round(N * 0.003) },
  ] },
];
// PPh final Pasal 4(2) selain UMKM yang lazim pada belanja pemerintah (objek khusus orang pribadi tidak dimasukkan).
export const P42N = {
  sewa: { n: 'Sewa tanah dan/atau bangunan', r: 0.10, p: '10%', d: 'Termasuk sewa gedung, ruang rapat/aula, gudang, dan kantor' },
  kk: { n: 'Pekerjaan konstruksi, kualifikasi kecil (bersertifikat)', r: 0.0175, p: '1,75%', d: 'Penyedia berkualifikasi kecil atau perseorangan bersertifikat' },
  ksk: { n: 'Pekerjaan konstruksi, kualifikasi menengah/besar (bersertifikat)', r: 0.0265, p: '2,65%', d: 'Penyedia berkualifikasi selain kecil' },
  kon4: { n: 'Pekerjaan konstruksi tanpa sertifikat', r: 0.04, p: '4%', d: 'Penyedia tanpa sertifikat badan usaha/kompetensi kerja' },
  int265: { n: 'Pekerjaan konstruksi terintegrasi bersertifikat', r: 0.0265, p: '2,65%', d: 'Rancang bangun (desain dan pelaksanaan sekaligus)' },
  int4: { n: 'Pekerjaan konstruksi terintegrasi tanpa sertifikat', r: 0.04, p: '4%', d: 'Rancang bangun oleh penyedia tanpa sertifikat' },
  kb: { n: 'Konsultansi konstruksi bersertifikat', r: 0.035, p: '3,5%', d: 'Perencanaan/pengawasan konstruksi oleh penyedia bersertifikat' },
  kons6: { n: 'Konsultansi konstruksi tanpa sertifikat', r: 0.06, p: '6%', d: 'Perencanaan/pengawasan konstruksi oleh penyedia tanpa sertifikat' },
  undian: { n: 'Hadiah undian', r: 0.25, p: '25%', d: 'Misalnya doorprize undian pada kegiatan' },
  alih: { n: 'Pengalihan hak atas tanah dan/atau bangunan', r: 0.025, p: '2,5%', d: 'Disetor sendiri oleh penjual; pengadaan tanah untuk kepentingan umum 0%' },
};
export function computeTax(N, S = { p42n: 'sewa' }) {
  if (!P42N[S.p42n]) S = { ...S, p42n: 'sewa' };
  const R = {};
  for (const g of TAX) for (const r of g.rows) R[r.k] = r.c(N, R, S);
  R.total = N + R.ppn;
  return R;
}
const SRC = { invoice: { t: 'Hitung Invoice', h: '#/alat/invoice' } };

export function viewPajak(ui, params) {
  if (params.n != null) store.set('pajak', { ...store.get('pajak', {}), n: parseRp(params.n), dari: SRC[params.dari] ? params.dari : null });
  const P = store.get('pajak', { n: 0, dari: null });

  const src = P.dari && SRC[P.dari] ? `<div class="tx-src">${ic('corner-down-left')} Diambil dari <a href="${SRC[P.dari].h}">${SRC[P.dari].t}</a>. Ubah angkanya di sini atau kembali ke sumbernya.</div>` : '';
  const html = `<div class="page-head"><h1 class="title">Kalkulator Pajak</h1><p class="subtitle">Isi nilai (N) langsung, atau buka Hitung Invoice lalu tekan Hitung pajak. PPN, PPh 22, PPh 23, dan PPh 4(2) langsung dihitung dengan rumusnya. Klik angka untuk menyalin. Semua hasil dibulatkan ke rupiah terdekat.</p></div>
  <div class="card tx-in">
    <label class="tx-lbl" for="txN">Nilai (N)</label>
    <div class="tx-box"><b>Rp</b><input id="txN" inputmode="numeric" autocomplete="off" placeholder="0" value="${fmtRp(P.n)}"></div>
    ${src}
    <div class="tx-pick">
      <span class="muted small">Ambil dari:</span>
      <a class="btn sm" href="#/alat/invoice">${ic('receipt')} Hitung Invoice ${ic('arrow-right')}</a>
      <span class="muted small tx-hint">isi daftar barang di sana, lalu tekan Hitung pajak</span>
      <button type="button" class="btn sm" id="txClear">${ic('x')} Kosongkan</button>
    </div>
  </div>
  <div class="tx-grid" id="txOut"></div>
  <div class="kp-foot muted small tx-foot">Rumus mengikuti Mesin Pengujian Tagihan. Ini alat bantu hitung, bukan penetapan pajak: jenis pajak, tarif, dan DPP yang berlaku tetap mengikuti ketentuan perpajakan dan status penyedia (misalnya NPWP, UMKM, sertifikat konstruksi).</div>`;
  const { $, $$, toast } = ui;
  const draw = () => {
    const N = P.n;
    if (!P42N[P.p42n]) P.p42n = 'sewa';
    const R = computeTax(N, P);
    const o = P42N[P.p42n];
    const selRow = (r) => `<div class="tx-r tx-sel">
        <span class="tx-n"><b>${esc(r.n)}</b>
          <select class="sel sm tx-dd" id="txP42" aria-label="PPh 4(2) non-UMKM atas">${Object.entries(P42N).map(([k, x]) => `<option value="${k}"${k === P.p42n ? ' selected' : ''}>${esc(x.n)} (${x.p})</option>`).join('')}</select>
          <small class="tx-d">PPh final Pasal 4(2) atas ${esc(o.n.toLowerCase())}. ${esc(o.d)}</small><small class="tx-f">N × ${o.p}</small></span>
        <button type="button" class="tx-vb" data-copy="${R[r.k]}" title="Salin ${esc(r.n)}"><span class="tx-v">${fmt(R[r.k])}</span>${ic('copy', 'tx-c')}</button>
      </div>`;
    const card = (g) => `<section class="card tx-g">
      <h2 class="tx-gh">${ic(g.i)}<span>${esc(g.t)}</span></h2>
      <div class="tx-rows">${g.rows.map((r) => r.sel ? selRow(r) : `<button type="button" class="tx-r" data-copy="${R[r.k]}" title="Salin ${esc(r.n)}"><span class="tx-n"><b>${esc(r.n)}</b><small class="tx-d">${esc(r.d)}</small><small class="tx-f">${esc(r.f)}</small></span><span class="tx-v">${fmt(R[r.k])}</span>${ic('copy', 'tx-c')}</button>`).join('')}</div>
      ${g.total ? `<button type="button" class="tx-r tx-total" data-copy="${R.total}" title="Salin total nilai"><span class="tx-n"><b>${esc(g.total.n)}</b><small class="tx-d">${esc(g.total.d)}</small><small class="tx-f">${esc(g.total.f)}</small></span><span class="tx-v">${fmt(R.total)}</span>${ic('copy', 'tx-c')}</button>` : ''}
    </section>`;
    // PC: baris atas PPN dan pemotongan/pemungutan (paling sering dipakai), baris bawah konstruksi dan PPh 21
    $('#txOut').innerHTML = TAX.map(card).join('');
  };
  const after = () => {
    draw();
    const inp = $('#txN');
    inp.addEventListener('input', () => { liveRp(inp); P.n = parseRp(inp.value); P.dari = null; store.set('pajak', P); const s = $('.tx-src'); if (s) s.remove(); draw(); });
    inp.addEventListener('focus', () => inp.select());
    $('#txOut').addEventListener('click', (e) => { const b = e.target.closest('[data-copy]'); if (b) ui.copy(b.dataset.copy, `${(b.querySelector('b') || b.closest('.tx-r').querySelector('b')).textContent} disalin`); });
    $('#txOut').addEventListener('change', (e) => { if (e.target.id !== 'txP42') return; P.p42n = e.target.value; store.set('pajak', P); draw(); $('#txP42').focus(); });
    $('#txClear').onclick = () => { P.n = 0; P.dari = null; /* pilihan dropdown dipertahankan */ store.set('pajak', P); history.replaceState(null, '', '#/alat/pajak'); ui.route(); };
    // Bersihkan ?n= dari alamat agar muat ulang tidak menimpa angka yang sudah diubah
    if (params.n != null) history.replaceState(null, '', '#/alat/pajak');
    if (!P.n) setTimeout(() => inp.focus(), 60);
  };
  return { html, after };
}
