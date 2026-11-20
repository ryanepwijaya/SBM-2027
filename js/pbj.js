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
  return { rows, lock: !!d?.lock };
}
const saveInv = (I) => store.set(INV_KEY, I);
const rowJumlah = (r, lock) => Math.round(parseDec(r.v) * parseRp(r.h) * (lock ? 1 : parseDec(r.f || '1')));
export function invoiceTotal(I = loadInv()) { return I.rows.reduce((a, r) => a + rowJumlah(r, I.lock), 0); }

export function viewInvoice(ui) {
  const I = loadInv();
  const html = `<div class="page-head"><h1 class="title">Hitung Invoice Barang/Jasa</h1><p class="subtitle">Isi daftar barang/jasa: volume, harga satuan, dan frekuensi. Semua bisa diisi tanpa mouse: tekan Tab untuk pindah kolom, dan Tab di kolom terakhir baris terakhir membuat baris baru. Totalnya bisa langsung dihitung pajaknya. Isian tersimpan di perangkat ini.</p></div>
  <div class="card iv">
    <div class="iv-bar">
      <label class="iv-lock"><input type="checkbox" id="ivLock"${I.lock ? ' checked' : ''}><span>Kunci semua frekuensi = 1 <small>(kolom Frek dilewati saat Tab)</small></span></label>
      <button type="button" class="btn sm" id="ivReset">${ic('history')} Reset</button>
    </div>
    <div class="iv-grid${I.lock ? ' locked' : ''}" id="ivGrid" role="table" aria-label="Daftar barang/jasa">
      <div class="iv-h" role="row"><span role="columnheader">No</span><span role="columnheader">Vol</span><span role="columnheader">Harga satuan (Rp)</span><span role="columnheader">Frek</span><span role="columnheader" class="n">Jumlah</span><span role="columnheader"><span class="sr">Hapus</span></span></div>
      <div id="ivRows"></div>
    </div>
    <div class="iv-add"><button type="button" class="btn sm" id="ivAdd">${ic('plus')} Tambah baris</button><span class="muted small">${ic('command')} Tab: kolom berikutnya · Enter: baris berikutnya · Shift+Tab: mundur</span></div>
    <div class="iv-tot">
      <div><div class="iv-tot-k">Total</div><div class="iv-tot-v" id="ivTot">Rp0</div><div class="muted small" id="ivMeta"></div></div>
      <div class="iv-tot-a"><button type="button" class="btn" id="ivCopy">${ic('copy')} Salin total</button><button type="button" class="btn primary" id="ivPajak">${ic('percent')} Hitung pajak ${ic('arrow-right')}</button></div>
    </div>
  </div>`;
  const { $, $$, toast } = ui;
  const rowHtml = (r, i) => `<div class="iv-r" role="row" data-i="${i}">
      <span class="iv-no" role="cell">${i + 1}</span>
      <span role="cell" data-l="Vol"><input class="iv-in" data-f="v" inputmode="decimal" autocomplete="off" value="${esc(r.v)}" placeholder="0" aria-label="Volume baris ${i + 1}"></span>
      <span role="cell" data-l="Harga satuan"><span class="iv-rp"><b>Rp</b><input class="iv-in" data-f="h" inputmode="numeric" autocomplete="off" value="${esc(r.h)}" placeholder="0" aria-label="Harga satuan baris ${i + 1}"></span></span>
      <span role="cell" data-l="Frek"><input class="iv-in" data-f="f" inputmode="decimal" autocomplete="off" value="${I.lock ? '1' : esc(r.f)}" aria-label="Frekuensi baris ${i + 1}"${I.lock ? ' tabindex="-1" readonly' : ''}></span>
      <span class="iv-j n" role="cell" data-l="Jumlah">${fmt(rowJumlah(r, I.lock))}</span>
      <span role="cell"><button type="button" class="icon-btn sm" data-del="${i}" tabindex="-1" aria-label="Hapus baris ${i + 1}">${ic('x')}</button></span>
    </div>`;
  function drawRows(focus) {
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
  const lastField = () => (I.lock ? 'h' : 'f');
  const isEmpty = (r) => !digits(r.v) && !digits(r.h);
  function addRow(focusF = 'v') { I.rows.push(newRow()); saveInv(I); drawRows({ i: I.rows.length - 1, f: focusF }); }
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
        if (last) { if (!isEmpty(I.rows[i])) addRow(f === 'f' && I.lock ? 'v' : f); else $('#ivPajak').focus(); }
        else drawRows({ i: i + 1, f: f === 'f' && I.lock ? 'v' : f });
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
    $('#ivLock').onchange = (e) => { I.lock = e.target.checked; saveInv(I); drawRows(); toast(I.lock ? 'Frekuensi dikunci 1 dan dilewati saat Tab' : 'Frekuensi bisa diisi per baris'); };
    $('#ivAdd').onclick = () => addRow();
    let armed = 0;
    $('#ivReset').onclick = () => {
      if (invoiceTotal(I) && Date.now() - armed > 3000) { armed = Date.now(); toast('Tekan Reset sekali lagi untuk mengosongkan daftar'); return; }
      I.rows = [newRow()]; saveInv(I); drawRows({ i: 0, f: 'v' }); toast('Daftar dikosongkan');
    };
    $('#ivCopy').onclick = () => ui.copy(String(invoiceTotal(I)), 'Total disalin');
    $('#ivPajak').onclick = () => { const t = invoiceTotal(I); if (t) location.hash = `#/alat/pajak?n=${t}&dari=invoice`; };
    if (I.rows.length === 1 && isEmpty(I.rows[0])) setTimeout(() => $('.iv-in[data-f="v"]')?.focus(), 60);
  };
  return { html, after };
}

/* ---------------- Kalkulator Pajak ---------------- */
const TAX = [
  { k: 'umum', t: 'Pajak umum', i: 'receipt', rows: [
    { k: 'dpp', n: 'DPP PPN', f: 'N × 11/12', c: (N) => Math.round(N * 11 / 12) },
    { k: 'ppn', n: 'PPN', f: 'DPP PPN × 12%', c: (N, R) => Math.round(R.dpp * 0.12) },
    { k: 'pph22', n: 'PPh 22', f: 'N × 1,5%', c: (N) => Math.round(N * 0.015) },
    { k: 'pph23', n: 'PPh 23', f: 'N × 2%', c: (N) => Math.round(N * 0.02) },
    { k: 'pph42', n: 'PPh 4(2) UMKM', f: 'N × 0,5%', c: (N) => Math.round(N * 0.005) },
    { k: 'ppn1', n: 'PPN 1%', f: 'PPN × 10%', c: (N, R) => Math.round(R.ppn * 0.10) },
    { k: 'ppn12', n: 'PPN 12%', f: 'N × 12%', c: (N) => Math.round(N * 0.12) },
    { k: 'pnbp', n: 'PNBP 0,3%', f: 'N × 0,3%', c: (N) => Math.round(N * 0.003) },
  ], total: { n: 'Total nilai', f: 'N + PPN', c: (N, R) => N + R.ppn } },
  { k: 'kons', t: 'PPh konstruksi dan konsultasi', i: 'building', rows: [
    { k: 'kk', n: 'Konstruksi (kecil)', f: 'N × 1,75%', c: (N) => Math.round(N * 0.0175) },
    { k: 'ksk', n: 'Konstruksi (selain kecil)', f: 'N × 2,65%', c: (N) => Math.round(N * 0.0265) },
    { k: 'kb', n: 'Konsultasi (bersertifikat)', f: 'N × 3,5%', c: (N) => Math.round(N * 0.035) },
  ] },
  { k: 'p21', t: 'PPh 21', i: 'users', rows: [
    { k: 't5', n: 'Tarif 5%', f: 'N × 5%', c: (N) => Math.round(N * 0.05) },
    { k: 't15', n: 'Tarif 15%', f: 'N × 15%', c: (N) => Math.round(N * 0.15) },
    { k: 't25', n: 'Tarif 2,5%', f: 'N × 2,5%', c: (N) => Math.round(N * 0.025) },
  ] },
];
export function computeTax(N) {
  const R = {};
  for (const g of TAX) for (const r of g.rows) R[r.k] = r.c(N, R);
  R.total = N + R.ppn;
  return R;
}
const SRC = { invoice: { t: 'Hitung Invoice', h: '#/alat/invoice' }, honor: { t: 'Hitung Honorarium', h: '#/alat/honor' } };

export function viewPajak(ui, params) {
  if (params.n != null) store.set('pajak', { n: parseRp(params.n), dari: SRC[params.dari] ? params.dari : null });
  const P = store.get('pajak', { n: 0, dari: null });
  const inv = invoiceTotal();
  const src = P.dari && SRC[P.dari] ? `<div class="tx-src">${ic('corner-down-left')} Diambil dari <a href="${SRC[P.dari].h}">${SRC[P.dari].t}</a>. Ubah angkanya di sini atau kembali ke sumbernya.</div>` : '';
  const html = `<div class="page-head"><h1 class="title">Kalkulator Pajak</h1><p class="subtitle">Isi nilai (N), atau ambil dari Hitung Invoice atau Hitung Honorarium. Semua jenis pajak langsung dihitung dengan rumusnya. Klik angka untuk menyalin. Semua hasil dibulatkan ke rupiah terdekat.</p></div>
  <div class="card tx-in">
    <label class="tx-lbl" for="txN">Nilai (N)</label>
    <div class="tx-box"><b>Rp</b><input id="txN" inputmode="numeric" autocomplete="off" placeholder="0" value="${fmtRp(P.n)}"></div>
    ${src}
    <div class="tx-pick">
      <span class="muted small">Ambil dari:</span>
      <button type="button" class="btn sm" id="txInv"${inv ? '' : ' disabled'}>${ic('receipt')} Hitung Invoice${inv ? ` · ${fmt(inv)}` : ' (kosong)'}</button>
      <button type="button" class="btn sm" disabled title="Segera hadir">${ic('hand-coins')} Hitung Honorarium <em class="soon-em">Segera</em></button>
      <button type="button" class="btn sm" id="txClear">${ic('x')} Kosongkan</button>
    </div>
  </div>
  <div class="tx-grid" id="txOut"></div>
  <div class="kp-foot muted small tx-foot">Rumus mengikuti Mesin Pengujian Tagihan. Ini alat bantu hitung, bukan penetapan pajak: jenis pajak, tarif, dan DPP yang berlaku tetap mengikuti ketentuan perpajakan dan status penyedia (misalnya NPWP, UMKM, sertifikat konstruksi).</div>`;
  const { $, $$, toast } = ui;
  const draw = () => {
    const N = P.n;
    const R = computeTax(N);
    const card = (g) => `<section class="card tx-g">
      <h2 class="tx-gh">${ic(g.i)}<span>${esc(g.t)}</span></h2>
      <div class="tx-rows">${g.rows.map((r) => `<button type="button" class="tx-r" data-copy="${R[r.k]}" title="Salin ${esc(r.n)}"><span class="tx-n"><b>${esc(r.n)}</b><small>${esc(r.f)}</small></span><span class="tx-v">${fmt(R[r.k])}</span>${ic('copy', 'tx-c')}</button>`).join('')}</div>
      ${g.total ? `<button type="button" class="tx-r tx-total" data-copy="${R.total}" title="Salin total nilai"><span class="tx-n"><b>${esc(g.total.n)}</b><small>${esc(g.total.f)}</small></span><span class="tx-v">${fmt(R.total)}</span>${ic('copy', 'tx-c')}</button>` : ''}
    </section>`;
    // Pajak umum di kiri; dua kelompok lain bertumpuk di kanan (PC)
    $('#txOut').innerHTML = card(TAX[0]) + `<div class="tx-side">${TAX.slice(1).map(card).join('')}</div>`;
  };
  const after = () => {
    draw();
    const inp = $('#txN');
    inp.addEventListener('input', () => { liveRp(inp); P.n = parseRp(inp.value); P.dari = null; store.set('pajak', P); const s = $('.tx-src'); if (s) s.remove(); draw(); });
    inp.addEventListener('focus', () => inp.select());
    $('#txOut').addEventListener('click', (e) => { const b = e.target.closest('[data-copy]'); if (b) ui.copy(b.dataset.copy, `${b.querySelector('b').textContent} disalin`); });
    const ib = $('#txInv');
    if (ib) ib.onclick = () => { location.hash = `#/alat/pajak?n=${invoiceTotal()}&dari=invoice`; };
    $('#txClear').onclick = () => { P.n = 0; P.dari = null; store.set('pajak', P); history.replaceState(null, '', '#/alat/pajak'); ui.route(); };
    // Bersihkan ?n= dari alamat agar muat ulang tidak menimpa angka yang sudah diubah
    if (params.n != null) history.replaceState(null, '', '#/alat/pajak');
    if (!P.n) setTimeout(() => inp.focus(), 60);
  };
  return { html, after };
}
