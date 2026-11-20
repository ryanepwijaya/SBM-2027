import { ENTRIES, GROUPS, SHORTCUTS, SIFAT, KEL_ORDER, DOC_NOTES, TOL, applyYear } from './catalog.js';
import { S, Y, YEARS, switchYear, initYear, loadData, entry, entriesOf, esc, norm, ref, lampShort, fmt, valueCols, unitCol, shortCol, UNIT, rowsOfProv, rapatTiers, pdfLink, store, tip, fold, money, effPct, setEffPct, clearEff, effAll, pctTxt, setEffKey } from './store.js';
import { search, buildIndex, SEARCH_HINTS } from './search.js';
import { ic } from './icons.js';
import { loadWilayah, suggest, resolve, routeHtml, placeLabel, routeHints, W } from './rute.js';
import { KP, compute, formHtml, resultHtml, buildPdf, resetKP, autoMalam } from './hitung.js';
import { viewMassal } from './massal.js';
import { lnSuggest, negOfCity, cityOfNeg } from './ln.js';
import { BABS, REF_LINKS, babByKey, babByKel, babOfButir } from './bab.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const NAV = [
  { k: 'beranda', h: '#/', t: 'Beranda', i: 'house' },
  { k: 'jelajah', h: '#/jelajah', t: 'Jelajah', i: 'compass' },
  { k: 'cari', h: '#/cari', t: 'Cari', i: 'search' },
  { k: 'alat', h: '#/alat', t: 'Alat Bantu', i: 'calculator' },
  { k: 'lainnya', h: '#/lainnya', t: 'Lainnya', i: 'menu' },
];
const SIDE_MAIN = [
  { k: 'beranda', h: '#/', t: 'Beranda', i: 'house' },
  { k: 'tersimpan', h: '#/tersimpan', t: 'Favorit', i: 'star' },
];
// Alat Bantu: alat hitung cepat untuk menguji pengadaan/pembayaran
const TOOLS = [
  {
    k: 'rute', h: '#/rute', t: 'Rute Perjadin', i: 'route', d: 'Satuan biaya perjalanan dinas dari kota asal ke kota tujuan, dan perkiraan biayanya',
    sub: [
      { k: 'rute', h: '#/rute', t: 'Buat Perjalanan', i: 'signpost', d: 'Dari kota X ke kota Y, semua satuan biaya perjalanan dinas langsung muncul' },
      { k: 'hitung', h: '#/hitung', t: 'Kalkulator Perjadin', i: 'calculator', d: 'Perkiraan biaya dari tujuan, lama, dan pelaksana surat tugas; bisa diunduh sebagai PDF' },
      { k: 'massal', h: '#/massal', t: 'Perjadin (banyak asal)', i: 'users', d: 'Satu kegiatan di satu kota, peserta dari banyak kota asal; unduh PDF dan Excel' },
      { k: 'tujuan', h: '#/tujuan', t: 'Perjadin (banyak tujuan)', i: 'map-pin', d: 'Dari satu kota asal ke banyak kota tujuan', soon: true },
    ],
  },
  {
    k: 'provinsi', h: '#/daerah', t: 'Biaya Per Provinsi', i: 'map', d: 'Semua satuan biaya SBM yang ditetapkan per provinsi, dikelompokkan per jenis biaya; bisa dibandingkan sampai 3 provinsi',
    sub: [{ k: 'ln', h: '#/daerah/ln', t: 'Luar Negeri', i: 'globe', d: 'Uang harian per negara dan tiket per kota' }], flat: true, last: true,
  },
  {
    k: 'pbj', h: '#/alat/honor', t: 'Pengadaan Barang/Jasa', i: 'shopping-cart', d: 'Alat hitung untuk honorarium, invoice barang/jasa, dan pajaknya', soon: true,
    sub: [
      { k: 'honor', h: '#/alat/honor', t: 'Hitung Honorarium', i: 'hand-coins', d: 'Honorarium kegiatan sesuai SBM', soon: true },
      { k: 'invoice', h: '#/alat/invoice', t: 'Hitung Invoice Barang/Jasa', i: 'receipt', d: 'Rincian nilai invoice pengadaan barang/jasa', soon: true },
      { k: 'pajak', h: '#/alat/pajak', t: 'Perpajakan', i: 'percent', d: 'PPN dan PPh atas pembayaran oleh bendahara', soon: true },
    ],
  },
];
// Biaya Per Provinsi selalu di urutan paling bawah Alat Bantu, termasuk bila ada alat baru
TOOLS.sort((a, b) => !!a.last - !!b.last);
const isDesk = () => window.matchMedia('(min-width: 1024px)').matches;
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || '');

/* ---------------- Tema ---------------- */
const mq = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const pref = store.get('theme', 'system');
  const dark = pref === 'dark' || (pref === 'system' && mq.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = dark ? '#0F173E' : '#222D63';
  $$('[data-theme-ico]').forEach((el) => { el.innerHTML = ic(dark ? 'sun' : 'moon'); el.title = dark ? 'Mode terang' : 'Mode gelap'; });
}
mq.addEventListener?.('change', applyTheme);
function toggleTheme() {
  const dark = document.documentElement.dataset.theme === 'dark';
  store.set('theme', dark ? 'light' : 'dark');
  applyTheme();
}

/* ---------------- Util UI ---------------- */
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 1800);
}
async function copy(text, msg = 'Disalin') {
  try { await navigator.clipboard.writeText(text); toast(msg); }
  catch { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast(msg); } catch { toast('Gagal menyalin'); } ta.remove(); }
}
const sifatChip = (b) => `<span class="chip ${SIFAT[b.sifat].cls}" title="${esc(SIFAT[b.sifat].text)}">${SIFAT[b.sifat].label}</span>`;
const sifatChipTip = (b) => `<span class="tip"><button type="button" class="tip-btn chip ${SIFAT[b.sifat].cls}">${SIFAT[b.sifat].label} ${ic('info')}</button><span class="tip-body" role="tooltip"><b>${SIFAT[b.sifat].label}.</b> ${esc(SIFAT[b.sifat].text)}</span></span>`;
const refChip = (b) => `<span class="chip ref">${lampShort(b)}</span>`;
const pdfBtn = (b) => `<a class="btn sm pdf-btn" href="${pdfLink(b)}" target="_blank" rel="noopener" title="Buka PDF asli ${Y.src} langsung di halaman tabel ini (tab baru)"><span class="pdf-badge">PDF</span><span>Cek di ${Y.srcKind} asli <b>${pageRange(b)}</b></span>${ic('external-link', 'pdf-ext')}</a>`;
// Daftar tabel yang sedang memakai persentase dibayar < 100%
function effNotice() {
  const all = effAll();
  const items = Object.entries(all).map(([k, v]) => {
    const [bid, t] = k.split(':'); const ti = Number(t);
    if (!S.butir[bid]) return null;
    const e = ENTRIES.find((x) => x.butir === bid && x.table === ti) || ENTRIES.find((x) => x.butir === bid);
    return `<a class="chip" href="#/b/${bid}?t=${ti}">${esc(e ? (e.tab || e.name) : S.butir[bid].title)} ${pctTxt(v)}</a>`;
  }).filter(Boolean);
  if (!items.length) return '';
  return `<div class="eff-note eff-sum" role="status">${ic('triangle-alert')}<div><b>Simulasi efisiensi aktif.</b> Angka berikut ditampilkan sebagian; besaran resmi tampil dicoret. <span class="chips">${items.join('')}</span></div><button type="button" class="btn sm" data-eff-clear>Kembali ke 100% semua</button></div>`;
}
// Kotak "Dibayar %" per komponen di alat Rute Perjadin: simpan saat selesai diketik (Enter atau keluar kotak)
document.addEventListener('change', (e) => {
  const i = e.target.closest('[data-effk]');
  if (!i) return;
  const raw = i.value.trim().replace(',', '.').replace('%', '');
  const v = raw === '' ? 100 : Number(raw);
  if (!(v > 0 && v <= 100)) { toast('Isi persentase 1 sampai 100'); route(); return; }
  for (const k of i.dataset.effk.split(',')) setEffKey(k, v);
  toast(v === 100 ? 'Kembali ke 100%' : `Dibayar ${pctTxt(v)}`);
  route();
});
document.addEventListener('keydown', (e) => { const i = e.target.closest('[data-effk]'); if (i && e.key === 'Enter') { e.preventDefault(); i.blur(); } });
document.addEventListener('focusin', (e) => { const i = e.target.closest('[data-effk]'); if (i) i.select(); });
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-eff-clear]');
  if (!b) return;
  clearEff(); toast('Semua kembali ke 100%'); route();
});

// Pilihan tahun anggaran (memuat ulang aplikasi dengan data tahun terpilih)
function yearSwitch(where) {
  const ys = Object.keys(YEARS).map(Number).sort((a, b) => b - a);
  const opts = ys.map((y) => `<button type="button" class="yr-opt${y === Y.y ? ' on' : ''}" role="option" aria-selected="${y === Y.y}" data-year="${y}"><span class="yr-opt-t"><b>${y}</b><small>${YEARS[y].sources}</small></span>${y === Y.y ? ic('check', 'yr-ok') : ''}</button>`).join('');
  return `<div class="yr yr-${where}"><button type="button" class="yr-btn" aria-haspopup="listbox" aria-expanded="false" title="Ganti tahun anggaran">${ic('calendar', 'yr-cal')}<span class="yr-lbl">Tahun Anggaran:</span><b class="yr-cur">${Y.y}</b>${ic('chevron-down', 'yr-chev')}</button><div class="yr-menu" role="listbox" aria-label="Tahun anggaran" hidden>${opts}</div></div>`;
}
function closeYearMenus(except) {
  document.querySelectorAll('.yr.open').forEach((w) => {
    if (w === except) return;
    w.classList.remove('open');
    w.querySelector('.yr-btn').setAttribute('aria-expanded', 'false');
    w.querySelector('.yr-menu').hidden = true;
  });
}
function openYearMenu(w) {
  const btn = w.querySelector('.yr-btn');
  const m = w.querySelector('.yr-menu');
  closeYearMenus(w);
  // posisi fixed agar tidak terpotong sidebar/topbar; ukur tombol sebelum menu ditampilkan
  const r = btn.getBoundingClientRect();
  w.classList.add('open'); btn.setAttribute('aria-expanded', 'true');
  const width = Math.max(r.width, 230);
  let left = r.left;
  if (left + width > innerWidth - 8) left = Math.max(8, innerWidth - 8 - width);
  m.style.cssText = `position:fixed;top:${Math.round(r.bottom + 6)}px;left:${Math.round(left)}px;width:${Math.round(width)}px`;
  m.hidden = false;
  (m.querySelector('.yr-opt.on') || m.querySelector('.yr-opt')).focus();
}
function bindYearSwitch(root) {
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('.yr-btn');
    if (btn) { e.preventDefault(); const w = btn.closest('.yr'); if (w.classList.contains('open')) closeYearMenus(); else openYearMenu(w); return; }
    const opt = e.target.closest('.yr-opt');
    if (opt) {
      e.preventDefault();
      const y = Number(opt.dataset.year);
      closeYearMenus();
      if (y !== Y.y) { document.querySelectorAll('.yr-cur').forEach((x) => { x.textContent = y; }); switchYear(y); }
      return;
    }
    if (!e.target.closest('.yr-menu')) closeYearMenus();
  });
  root.addEventListener('keydown', (e) => {
    const w = document.querySelector('.yr.open');
    if (!w) return;
    if (e.key === 'Escape') { closeYearMenus(); w.querySelector('.yr-btn').focus(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const os = [...w.querySelectorAll('.yr-opt')];
      const i = os.indexOf(document.activeElement);
      os[(i + (e.key === 'ArrowDown' ? 1 : -1) + os.length) % os.length].focus();
      e.preventDefault();
    }
  });
  window.addEventListener('resize', () => closeYearMenus());
  window.addEventListener('hashchange', () => closeYearMenus());
}
const firstVal = (t) => { const r = t.rows.find((x) => x.n); const i = valueCols(t)[0]; return r ? r.n[i] : null; };
const pageRange = (b) => (b.pages.length > 1 ? `hal. ${b.pages[0]}–${b.pages[b.pages.length - 1]}` : `hal. ${b.pages[0]}`);
const groupOf = (gid) => GROUPS.find((g) => g.id === gid);

function saved() { return store.get('saved', []); }
function isSaved(k) { return saved().includes(k); }
function toggleSaved(k) {
  const s = saved();
  const i = s.indexOf(k);
  if (i >= 0) s.splice(i, 1); else s.unshift(k);
  store.set('saved', s);
  return i < 0;
}
function pushRecent(k) {
  const r = store.get('recent', []).filter((x) => x !== k);
  r.unshift(k);
  store.set('recent', r.slice(0, 6));
}

/* ---------------- Shell ---------------- */
function shell() {
  const bottom = NAV.map((n) => n.k === 'cari'
    ? `<a href="${n.h}" data-nav="${n.k}" class="search-fab"><span class="fab">${ic('search')}</span><span class="lbl">${n.t}</span></a>`
    : `<a href="${n.h}" data-nav="${n.k}">${ic(n.i)}<span>${n.t}</span></a>`).join('');
  const brand = `<a class="brand" href="#/"><span class="brand-mark"><span>SBM</span></span><span class="brand-text"><b>Standar Biaya Masukan</b><small>${Y.sources}</small></span></a>`;
  $('#app').innerHTML = `
  <aside class="sidebar" aria-label="Navigasi">
    ${brand}
    <div class="side-year">${yearSwitch('side')}</div>
    <div class="side-scroll" id="sideScroll">${sideHtml()}</div>
    <div class="side-foot">
      <button class="side-btn" id="sideTheme" data-theme-ico aria-label="Ganti tema" data-tip="Ganti tema"></button>
      <span class="side-ver">© ${authorLink()}</span>
      <button class="side-btn" id="railBtn" aria-label="Ciutkan sidebar" data-tip="Lebarkan sidebar">${ic('panel-left-close')}</button>
    </div>
  </aside>
  <div class="content">
    <header class="topbar">
      ${brand}
      ${yearSwitch('top')}
      <nav class="crumbs" id="crumbs" aria-label="Lokasi"></nav>
      <span class="spacer"></span>
      <button class="top-search" id="topSearch" type="button" aria-label="Cari">${ic('search')}<span>Cari satuan biaya, kota, atau aturan…</span><kbd>${isMac ? '⌘' : 'Ctrl'} K</kbd></button>
      <button class="icon-btn" id="themeBtn" data-theme-ico aria-label="Ganti tema"></button>
    </header>
    <main class="main" id="main" tabindex="-1"></main>
  </div>
  <nav class="bottomnav">${bottom}</nav>
  <div class="pal" id="pal" hidden>
    <div class="pal-back" data-pal-close></div>
    <div class="pal-box" role="dialog" aria-modal="true" aria-label="Cari di SBM ${Y.y}">
      <div class="pal-in">${ic('search')}<input id="palq" type="search" placeholder="Cari satuan biaya, provinsi, kota, rute, atau kata dalam aturan…" autocomplete="off" spellcheck="false" aria-controls="palList"><kbd data-pal-close>Esc</kbd></div>
      <div class="pal-list" id="palList" role="listbox"></div>
      <div class="pal-foot"><span><kbd>↑</kbd><kbd>↓</kbd> pilih</span><span><kbd>↵</kbd> buka</span><span><kbd>Esc</kbd> tutup</span><a id="palAll" href="#/cari">Lihat semua hasil ${ic('arrow-right')}</a></div>
    </div>
  </div>
  <div class="rail-tip" id="railTip" role="tooltip"></div>
  <div class="toast" id="toast" role="status"></div>`;
  $('#themeBtn').onclick = toggleTheme;
  $('#sideTheme').onclick = toggleTheme;
  bindYearSwitch(document);
  $('#topSearch').onclick = () => openPalette('');
  document.addEventListener('keydown', (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
    const isK = e.key && e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey);
    if ((e.key === '/' && !typing) || isK) {
      e.preventDefault();
      if (isDesk()) { if (palOpen()) closePalette(); else openPalette(''); }
      else if ($('#q')) $('#q').focus();
      else location.hash = '#/cari';
    }
  });
  initSidebar();
  initPalette();
  applyTheme();
}

/* ---------------- Sidebar (PC) ---------------- */
function sideHtml() {
  const main = SIDE_MAIN.map((n) => `<a class="side-link" href="${n.h}" data-side="${n.k}" data-tip="${n.t}">${ic(n.i)}<span>${n.t}</span></a>`).join('');
  const acc = (key, name, icon, badge, body, cls = '') => `
    <div class="acc${cls}" data-acc="${key}">
      <button class="acc-h" type="button" aria-expanded="false" aria-controls="acc-${key}" data-tip="${esc(name)}">
        <span class="acc-ico">${ic(icon)}</span><span class="acc-t">${esc(name)}</span>${badge}${ic('chevron-down', 'acc-chev')}
      </button>
      <div class="acc-p" id="acc-${key}"><div class="acc-in">${body}</div></div>
    </div>`;
  const stagger = (arr) => arr.map((h, i) => h.replace('<a ', `<a style="--i:${Math.min(i, 14)}" `).replace('<div ', `<div style="--i:${Math.min(i, 14)}" `)).join('');
  const babs = BABS.map((b) => {
    const parts = [`<div class="fly-h">${ic(b.icon)}${esc(b.name)}</div>`];
    parts.push(`<a class="acc-it acc-all" href="#/bab/${b.key}" data-item="bab:${b.key}">${ic('layout-grid')}<span>Ringkasan bab</span></a>`);
    if (!b.active) parts.push(`<div class="acc-soon">${ic('clock')}<span>Segera hadir. Daftar butirnya sudah bisa dilihat.</span></div>`);
    for (const g of b.groups) {
      if (g.t) parts.push(`<div class="acc-g">${esc(g.t)}</div>`);
      for (const it of g.items) parts.push(`<a class="acc-it${it.active ? '' : ' off'}" href="${it.href}" data-item="${it.k}" title="${esc(it.full || it.n)}">${ic(it.icon)}<span>${esc(it.n)}</span>${it.active ? '' : ic('lock-keyhole', 'lk')}</a>`);
    }
    const badge = b.active ? `<span class="acc-n">${b.count}</span>` : '<span class="acc-n soon">Segera</span>';
    return acc(b.key, b.name, b.icon, badge, stagger(parts), b.active ? '' : ' soon');
  }).join('');
  const refBody = stagger([`<div class="fly-h">${ic('library')}Referensi</div>`, ...REF_LINKS.map((r) => `<a class="acc-it" href="${r.h}" data-item="ref:${r.h}">${ic(r.icon)}<span>${esc(r.n)}</span></a>`)]);
  const toolLinks = TOOLS.map((t) => {
    if (t.sub && !t.flat) {
      const body = stagger([`<div class="fly-h">${ic(t.i)}${esc(t.t)}</div>`, ...t.sub.filter((x) => !x.hideSide).map((x) => `<a class="acc-it${x.soon ? ' soon-it' : ''}" href="${x.h}" data-item="tool:${x.k}" title="${esc(x.t)}${x.soon ? ' (segera hadir)' : ''}">${ic(x.i)}<span>${esc(x.t)}</span>${x.soon ? ic('clock', 'lk') : ''}</a>`)]);
      return acc(t.k, t.t, t.i, '', body);
    }
    return `<a class="side-link" href="${t.h}" data-side="${t.k}" data-tip="${esc(t.t)}">${ic(t.i)}<span>${esc(t.t)}</span>${t.soon ? '<em class="side-soon">Segera</em>' : ''}</a>`;
  }).join('');
  return `
    <nav class="side-main">${main}</nav>
    <div class="side-label">Alat bantu</div>
    <div class="side-babs side-tools" aria-label="Alat bantu">${toolLinks}</div>
    <div class="side-label">Bab satuan biaya</div>
    <div class="side-babs">${babs}</div>
    <div class="side-label">Referensi</div>
    <div class="side-babs">${acc('ref', 'Referensi', 'library', '', refBody)}</div>`;
}

let openAcc = null;
let keepFly = null;
function setAcc(key, { scroll = false } = {}) {
  openAcc = key;
  const rail = document.documentElement.dataset.rail === '1';
  $$('.acc').forEach((a) => {
    const on = !rail && a.dataset.acc === key;
    a.classList.toggle('open', on);
    a.querySelector('.acc-h').setAttribute('aria-expanded', String(on));
  });
  if (scroll && key && !rail) setTimeout(() => sideReveal(key), 380);
}
function sideReveal(key) {
  const sc = $('#sideScroll');
  const acc = $(`.acc[data-acc="${key}"]`);
  if (!sc || !acc) return;
  const s = sc.getBoundingClientRect();
  const on = acc.querySelector('.acc-it.on');
  const h = acc.querySelector('.acc-h').getBoundingClientRect();
  const a = acc.getBoundingClientRect();
  let dy = 0;
  if (on) {
    const r = on.getBoundingClientRect();
    if (r.bottom > s.bottom - 12) dy = r.bottom - s.bottom + 48;
    else if (r.top < s.top + 12) dy = r.top - s.top - 48;
  } else if (a.bottom > s.bottom - 8) dy = Math.min(a.bottom - s.bottom + 8, h.top - s.top - 8);
  else if (h.top < s.top) dy = h.top - s.top - 8;
  if (dy) sc.scrollBy({ top: dy, behavior: 'smooth' });
}
function closeFly() { $$('.acc.fly').forEach((a) => a.classList.remove('fly')); }
function openFly(acc) {
  const was = acc.classList.contains('fly');
  closeFly();
  hideRailTip();
  if (was) return;
  const h = acc.querySelector('.acc-h').getBoundingClientRect();
  const p = acc.querySelector('.acc-p');
  acc.classList.add('fly');
  const maxH = window.innerHeight - 24;
  const ph = Math.min(p.scrollHeight, maxH);
  p.style.top = Math.max(12, Math.min(h.top - 6, window.innerHeight - ph - 12)) + 'px';
}
function setRail(on) {
  document.documentElement.dataset.rail = on ? '1' : '0';
  store.set('rail', on);
  const b = $('#railBtn');
  if (b) { b.innerHTML = ic(on ? 'panel-left-open' : 'panel-left-close'); b.setAttribute('aria-label', on ? 'Lebarkan sidebar' : 'Ciutkan sidebar'); }
  closeFly();
  setAcc(openAcc);
}
const railTip = () => $('#railTip');
function hideRailTip() { railTip()?.classList.remove('show'); }
function initSidebar() {
  setRail(!!store.get('rail', false));
  $('#railBtn').onclick = () => setRail(document.documentElement.dataset.rail !== '1');
  $('#sideScroll').addEventListener('click', (e) => {
    const h = e.target.closest('.acc-h');
    if (!h) return;
    const acc = h.closest('.acc');
    const key = acc.dataset.acc;
    const tool = TOOLS.find((t) => t.k === key && t.sub && !t.flat);
    const target = babByKey(key) ? '#/bab/' + key : tool ? tool.h : null; // Referensi tidak punya halaman ringkasan
    const onTarget = target && location.hash.split('?')[0] === target;
    if (document.documentElement.dataset.rail === '1') {
      const wasFly = acc.classList.contains('fly');
      if (!wasFly || !target || onTarget) openFly(acc); // buka/tutup flyout
      if (target && !onTarget) { keepFly = key; location.hash = target; }
      return;
    }
    // Klik bab: buka sub-menu sekaligus ke Ringkasan bab. Klik lagi saat sudah di ringkasan: tutup.
    if (acc.classList.contains('open') && (!target || onTarget)) { setAcc(null); return; }
    setAcc(key, { scroll: true });
    if (target && !onTarget) location.hash = target;
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.acc.fly')) closeFly(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeFly(); });
  window.addEventListener('resize', closeFly);
  $('#sideScroll').addEventListener('scroll', closeFly, { passive: true });
  // tooltip mode ciut
  const sb = $('.sidebar');
  sb.addEventListener('mouseover', (e) => {
    const el = e.target.closest('[data-tip]');
    if (!el || document.documentElement.dataset.rail !== '1' || el.closest('.acc.fly')) return;
    if (el.closest('.acc')?.classList.contains('fly')) return;
    const r = el.getBoundingClientRect();
    const t = railTip();
    t.textContent = el.dataset.tip;
    t.style.top = r.top + r.height / 2 + 'px';
    t.style.left = r.right + 10 + 'px';
    t.classList.add('show');
  });
  sb.addEventListener('mouseout', (e) => { if (!e.relatedTarget || !sb.contains(e.relatedTarget) || !e.relatedTarget.closest('[data-tip]')) hideRailTip(); });
}
function sideActive(sideKey, itemKey, babKey) {
  $$('[data-side]').forEach((a) => a.classList.toggle('on', a.dataset.side === sideKey));
  $$('[data-item]').forEach((a) => a.classList.toggle('on', a.dataset.item === itemKey));
  $$('.acc').forEach((a) => a.classList.toggle('has-on', !!itemKey && !!a.querySelector(`[data-item="${CSS.escape(itemKey)}"]`)));
  if (babKey && babKey !== openAcc) setAcc(babKey, { scroll: true });
  else if (babKey) setTimeout(() => sideReveal(babKey), 30);
  if (keepFly && keepFly === babKey) keepFly = null; // flyout tetap terbuka setelah klik bab di mode ciut
  else closeFly();
}

/* ---------------- Breadcrumb ---------------- */
function setCrumbs(list) {
  const el = $('#crumbs');
  if (!el) return;
  el.innerHTML = list.map((c, i) => {
    const last = i === list.length - 1;
    const inner = `${c.i ? ic(c.i) : ''}<span>${esc(c.t)}</span>`;
    return (i ? ic('chevron-right', 'cs') : '') + (c.h && !last ? `<a href="${c.h}">${inner}</a>` : `<b${last ? ' aria-current="page"' : ''}>${inner}</b>`);
  }).join('');
}

function setNav(k) {
  $$('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === k));
}

/* ---------------- Jendela cari (PC) ---------------- */
let palIdx = 0;
let palItems = [];
const palOpen = () => !$('#pal').hidden;
function openPalette(q) {
  const pal = $('#pal');
  const inp = $('#palq');
  if (pal.hidden) {
    pal.hidden = false;
    requestAnimationFrame(() => pal.classList.add('show'));
  }
  inp.value = q || '';
  renderPalette(inp.value);
  inp.focus();
  inp.setSelectionRange(inp.value.length, inp.value.length);
}
function closePalette() {
  const pal = $('#pal');
  if (pal.hidden) return;
  pal.classList.remove('show');
  setTimeout(() => { pal.hidden = true; }, 160);
}
function babIconOf(butirId) {
  const b = babOfButir(butirId);
  const it = b?.items.find((x) => x.butir === butirId);
  return it?.icon || b?.icon || 'file-text';
}
function renderPalette(q) {
  const list = $('#palList');
  const all = $('#palAll');
  all.href = '#/cari' + (q.trim() ? '?q=' + encodeURIComponent(q) : '');
  const secs = [];
  const item = (x) => ({ href: x.href, t: x.t, html: !!x.html, d: x.d, dHtml: !!(x.html || x.snip), i: x.i, k: x.k, v: x.v });
  if (!q.trim()) {
    const recent = store.get('recent', []).map(entry).filter(Boolean).slice(0, 4);
    if (recent.length) secs.push({ t: 'Terakhir dilihat', items: recent.map((e) => item({ href: `#/b/${e.butir}?t=${e.table}`, t: e.name, d: e.desc, i: e.icon })) });
    secs.push({ t: 'Buka bab', items: BABS.map((b) => item({ href: `#/bab/${b.key}`, t: b.name, d: b.desc, i: b.icon, k: b.active ? `${b.count} jenis` : 'Segera' })) });
    secs.push({ t: 'Alat', items: [
      item({ href: '#/rute', t: 'Buat Perjalanan', d: 'Dari kota X ke kota Y: semua satuan biaya yang relevan', i: 'signpost' }),
      item({ href: '#/daerah', t: 'Biaya Per Provinsi', d: 'Semua satuan biaya per provinsi; bisa dibandingkan sampai 3 provinsi', i: 'map' }),
      item({ href: '#/hitung', t: 'Kalkulator Perjadin', d: 'Perkiraan biaya dari tujuan, lama, dan pelaksana', i: 'calculator' }),
      item({ href: '#/massal', t: 'Perjadin (banyak asal)', d: 'Satu kegiatan, peserta dari banyak kota asal; PDF dan Excel', i: 'users' }),
      item({ href: '#/daerah/ln', t: 'Luar Negeri', d: 'Uang harian per negara dan tiket per kota', i: 'globe' }),
    ] });
    const hist = store.get('qhist', []).slice(0, 5);
    if (hist.length) secs.push({ t: 'Pencarian terakhir', items: hist.map((h) => item({ href: '#q:' + h, t: h, i: 'history' })) });
  } else {
    const r = search(q);
    if (r.best.length) secs.push({ t: 'Langsung ke', items: r.best.slice(0, 6).map((x) => item({ ...x, i: x.kind === 'Rute' ? 'route' : x.kind === 'Daerah' ? 'map' : x.kind === 'Bab' ? 'plane' : 'corner-down-left', k: x.kind })) });
    if (r.menus.length) secs.push({ t: 'Jenis satuan biaya', items: r.menus.slice(0, 6).map((x) => item({ ...x, i: babIconOf(x.ref.id), k: lampShort(x.ref) })) });
    if (r.rows.length) secs.push({ t: 'Baris tabel', items: r.rows.slice(0, 6).map((x) => item({ ...x, d: (x.d || '') + (x.v ? ' · ' + x.v : ''), html: true, i: 'list', v: null })) });
    if (r.pens.length) secs.push({ t: 'Dalam teks aturan', items: r.pens.slice(0, 4).map((x) => item({ ...x, snip: true, i: 'file-text', k: x.src.split(' ')[0] })) });
    if (r.soon.length) secs.push({ t: 'Belum tersedia', items: r.soon.slice(0, 4).map((b) => item({ href: `#/b/${b.id}`, t: b.title, d: `${babByKel(b.kel)?.name || ''} · ${lampShort(b)}`, i: 'lock-keyhole', k: 'Segera' })) });
    if (r.corrected) secs.unshift({ t: `Menampilkan hasil untuk “${r.corrected}”`, items: [] });
  }
  palItems = secs.flatMap((s) => s.items);
  palIdx = 0;
  let n = 0;
  list.innerHTML = palItems.length || secs.length ? secs.map((s) => `<div class="pal-sec">${esc(s.t)}</div>${s.items.map((x) => {
    const i = n++;
    return `<a class="pal-it${i === 0 ? ' on' : ''}" href="${esc(x.href)}" data-pi="${i}" role="option"><span class="pal-ico">${ic(x.i || 'arrow-right')}</span><span class="pal-tx"><span class="pal-t">${x.html ? x.t : esc(x.t)}</span>${x.d ? `<span class="pal-d">${x.dHtml ? x.d : esc(x.d)}</span>` : ''}</span>${x.k ? `<span class="pal-k">${esc(x.k)}</span>` : ''}${ic('corner-down-left', 'pal-enter')}</a>`;
  }).join('')}`).join('') : '';
  if (q.trim() && !palItems.length) list.innerHTML = `<div class="pal-empty">${ic('search')}<b>Tidak ada hasil untuk “${esc(q)}”</b><span>Coba nama provinsi, kota, atau jenis biaya.</span></div>`;
}
function palMove(d) {
  if (!palItems.length) return;
  palIdx = (palIdx + d + palItems.length) % palItems.length;
  $$('#palList .pal-it').forEach((a) => a.classList.toggle('on', Number(a.dataset.pi) === palIdx));
  $(`#palList [data-pi="${palIdx}"]`)?.scrollIntoView({ block: 'nearest' });
}
function palGo(href) {
  if (href.startsWith('#q:')) { openPalette(href.slice(3)); return; }
  saveQuery($('#palq').value);
  closePalette();
  location.hash = href;
}
function initPalette() {
  const inp = $('#palq');
  let tmr;
  inp.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(() => renderPalette(inp.value), 70); });
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); palMove(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); palMove(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); const it = palItems[palIdx]; if (it) palGo(it.href); else if (inp.value.trim()) palGo('#/cari?q=' + encodeURIComponent(inp.value)); }
    else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
  });
  $('#pal').addEventListener('click', (e) => {
    if (e.target.closest('[data-pal-close]')) { closePalette(); return; }
    const a = e.target.closest('a.pal-it');
    if (a) { e.preventDefault(); palGo(a.getAttribute('href')); return; }
    if (e.target.closest('#palAll')) { e.preventDefault(); palGo($('#palAll').getAttribute('href')); }
  });
  $('#palList').addEventListener('mousemove', (e) => {
    const a = e.target.closest('.pal-it');
    if (a && Number(a.dataset.pi) !== palIdx) { palIdx = Number(a.dataset.pi); $$('#palList .pal-it').forEach((x) => x.classList.toggle('on', x === a)); }
  });
  window.addEventListener('hashchange', closePalette);
}

/* ---------------- Router ---------------- */
function parseHash() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = h.split('?');
  const params = Object.fromEntries(new URLSearchParams((qs || '').split('#')[0]));
  const anchor = h.includes('#') ? h.split('#')[1] : null;
  return { parts: path.split('/').filter(Boolean), params, anchor };
}

let lastPath = null;
const ALAT_CRUMB = { t: 'Alat Bantu', h: '#/alat' };
const RUTE_CRUMB = { t: 'Rute Perjadin', h: '#/rute', i: 'route' };
function route() {
  const { parts, params, anchor } = parseHash();
  const main = $('#main');
  const key = parts[0] || 'beranda';
  const pathKey = parts.join('/');
  // pencarian: perbarui hasil tanpa merender ulang kotak
  if (key === 'cari' && lastPath === 'cari' && $('#q')) {
    updateResults(params.q || '');
    return;
  }
  if (key === 'segera') { const bb = babByKel(parts[1]); location.replace('#/bab/' + (bb ? bb.key : 'perjadin')); return; }
  let html = '';
  let after = null;
  const home = { t: 'Beranda', h: '#/', i: 'house' };
  let cr = [home];
  let side = [null, null, null];
  try {
    switch (key) {
      case 'beranda': setNav('beranda'); side = ['beranda']; html = viewHome(); after = afterHome; break;
      case 'jelajah': setNav('jelajah'); cr.push({ t: 'Jelajah' }); html = viewJelajah(); break;
      case 'bab': {
        setNav('jelajah');
        const bb = babByKey(parts[1]) || BABS[0];
        cr.push({ t: bb.name, i: bb.icon });
        side = [null, 'bab:' + bb.key, bb.key];
        ({ html, after } = viewBab(bb));
        break;
      }
      case 'b': {
        setNav('jelajah');
        const bb = babOfButir(parts[1]);
        if (bb) {
          const ti = Number(params.t || 0);
          const it = bb.items.find((x) => x.butir === parts[1] && x.table === ti) || bb.items.find((x) => x.butir === parts[1]);
          cr.push({ t: bb.name, h: '#/bab/' + bb.key, i: bb.icon }, { t: it ? (it.full || it.n) : parts[1] });
          side = [null, it?.k, bb.key];
        }
        ({ html, after } = viewButir(parts[1], params, anchor));
        break;
      }
      case 'cari': setNav('cari'); cr.push({ t: 'Cari' }); html = viewCari(params.q || ''); after = () => afterCari(params.q || ''); break;
      case 'alat':
        setNav('alat');
        cr.push({ t: 'Alat Bantu', h: '#/alat', i: 'calculator' });
        if (['honor', 'invoice', 'pajak'].includes(parts[1])) {
          const t = TOOLS.find((x) => x.k === 'pbj').sub.find((x) => x.k === parts[1]);
          side = [null, 'tool:' + t.k, 'pbj'];
          cr.push({ t: 'Pengadaan Barang/Jasa', h: '#/alat/honor', i: 'shopping-cart' }, { t: t.t });
          html = viewSoonTool(t, TOOLS.find((x) => x.k === 'pbj'));
        }
        else { cr[cr.length - 1] = { t: 'Alat Bantu', i: 'calculator' }; html = viewAlat(); }
        break;
      case 'daerah':
        setNav('alat');
        side = ['provinsi'];
        cr.push(ALAT_CRUMB);
        if (parts[1] === 'p') { cr.push({ t: 'Biaya Per Provinsi', h: '#/daerah', i: 'map' }, { t: S.prov[parts[2]]?.nama || 'Provinsi' }); ({ html, after } = viewProv(parts[2], params)); }
        else if (parts[1] === 'ln') { cr.push({ t: 'Biaya Per Provinsi', h: '#/daerah', i: 'map' }, { t: 'Luar Negeri' }); ({ html, after } = viewDaerah('ln', params)); }
        else { cr.push({ t: 'Biaya Per Provinsi', i: 'map' }); ({ html, after } = viewDaerah('dn', params)); }
        break;
      case 'rute': setNav('alat'); side = [null, 'tool:rute', 'rute']; cr.push(ALAT_CRUMB, RUTE_CRUMB, { t: 'Buat Perjalanan' }); ({ html, after } = viewRute(params)); break;
      case 'massal': setNav('alat'); side = [null, 'tool:massal', 'rute']; cr.push(ALAT_CRUMB, RUTE_CRUMB, { t: 'Perjadin (banyak asal)' }); ({ html, after } = viewMassal({ $, $$, toast, effNotice, placeField, attachAC })); break;
      case 'tujuan': { setNav('alat'); const rt = TOOLS.find((x) => x.k === 'rute'); const t = rt.sub.find((x) => x.k === 'tujuan'); side = [null, 'tool:tujuan', 'rute']; cr.push(ALAT_CRUMB, RUTE_CRUMB, { t: t.t }); html = viewSoonTool(t, rt); break; }
      case 'hitung': setNav('alat'); side = [null, 'tool:hitung', 'rute']; cr.push(ALAT_CRUMB, RUTE_CRUMB, { t: 'Kalkulator Perjadin' }); ({ html, after } = viewHitung()); break;
      case 'bandingkan': {
        // Bandingkan Wilayah dilebur ke Biaya Per Provinsi
        const ps = (params.p || '').split(',').filter((x) => S.prov[x]);
        location.replace(ps.length ? `#/daerah/p/${ps[0]}${ps.length > 1 ? '?vs=' + ps.slice(1, 3).join(',') : ''}` : '#/daerah');
        return;
      }
      case 'tersimpan': setNav('tersimpan'); side = ['tersimpan']; cr.push({ t: 'Favorit', i: 'star' }); html = viewSaved(); break;
      case 'lainnya': {
        setNav('lainnya');
        const ref = REF_LINKS.find((r) => r.h === '#/' + parts.join('/'));
        cr.push(parts[1] ? { t: 'Referensi', h: '#/lainnya', i: 'library' } : { t: 'Lainnya' });
        if (parts[1] && ref) cr.push({ t: ref.n });
        side = [null, ref ? 'ref:' + ref.h : null, 'ref'];
        ({ html, after } = viewMore(parts[1]));
        break;
      }
      default: html = `<div class="empty">Halaman tidak ditemukan. <a href="#/">Kembali ke Beranda</a></div>`;
    }
  } catch (err) {
    console.error(err);
    html = `<div class="empty">Terjadi kesalahan saat menampilkan halaman. <a href="#/">Kembali ke Beranda</a></div>`;
  }
  html = html.replace(/<\/h1>\s*<p class="subtitle">([\s\S]*?)<\/p>/g, (m, t) => ` ${tip(t)}</h1>`);
  main.innerHTML = html + footer();
  if (pathKey !== lastPath) {
    window.scrollTo(0, 0); main.classList.remove('enter'); void main.offsetWidth; main.classList.add('enter');
    // Lepas kelas animasi setelah selesai agar tidak ada lapisan (stacking context) yang menimpa keterangan (i)
    clearTimeout(main._enterT); main._enterT = setTimeout(() => main.classList.remove('enter'), 1100);
  }
  lastPath = key === 'cari' ? 'cari' : pathKey;
  setCrumbs(cr);
  sideActive(side[0], side[1], side[2]);
  if (after) after();
}

const AUTHOR = { handle: '@ryanepwijaya', url: 'https://www.threads.com/@ryanepwijaya' };
const authorLink = (cls = '') => `<a class="${cls}" href="${AUTHOR.url}" target="_blank" rel="noopener" title="Buka Threads ${AUTHOR.handle}">${AUTHOR.handle}</a>`;
function footer() {
  const about = Y.y === 2026
    ? 'PMK Nomor 32 Tahun 2025 tentang Standar Biaya Masukan Tahun Anggaran 2026.'
    : 'PMK Nomor 54 Tahun 2026 tentang Standar Biaya Masukan dan KMK Nomor 296 Tahun 2026 tentang Rincian Besaran Standar Biaya Masukan (TA 2027).';
  return `<footer class="foot">
    <p class="foot-disc">${ic('info')}<span>Aplikasi ini alat bantu baca, bukan dokumen resmi. Selalu cek ulang ke ketentuan aslinya, dan konsultasikan kebijakan internal satker dengan pejabat perbendaharaan di satker Anda. <a href="#/lainnya/tentang">Selengkapnya</a></span></p>
    <p class="foot-meta"><span>Sumber: ${Y.sources} ${tip(about)}</span><span class="dot">·</span><span>© 2026 Dibuat oleh ${authorLink()}</span></p>
  </footer>`;
}
// Penafian lengkap (halaman Tentang)
function disclaimerCard() {
  return `<section class="card card-pad disc-card" id="penafian"><h2 class="disc-h">${ic('triangle-alert')} Penafian</h2>
    <ol class="disc-list">
      <li>Aplikasi ini adalah alat bantu baca yang disusun secara mandiri, <b>bukan dokumen atau publikasi resmi</b> Kementerian Keuangan.</li>
      <li>Angka dan teks diambil dari ${esc(Y.src)}${Y.y === 2027 ? ' dan PMK 54/2026' : ''} dan sudah dicek silang, tetapi kesalahan ekstraksi tetap mungkin terjadi. <b>Selalu cek ulang ke ketentuan aslinya</b> sebelum dipakai untuk penyusunan anggaran, pengujian tagihan, atau pertanggungjawaban. Tombol PDF di setiap halaman membuka halaman dokumen yang dirujuk.</li>
      <li>Hasil Kalkulator Perjadin dan simulasi persentase dibayar adalah <b>perkiraan</b>, bukan dasar pembayaran.</li>
      <li>Satker dapat menetapkan kebijakan internal, misalnya efisiensi atau pembatasan tertentu. <b>Konsultasikan dengan pejabat perbendaharaan di satker Anda</b> (PPK, PPSPM, atau bendahara) untuk kebijakan yang berlaku di satker.</li>
    </ol>
    <p class="disc-by">© 2026 Dibuat oleh ${authorLink()}.</p>
  </section>`;
}

/* ---------------- Beranda ---------------- */
const HOME_HINTS = ['uang harian surakarta', 'jakarta surabaya', 'penginapan bali', 'honorarium narasumber'];
function babCard(b, i) {
  const pops = b.popular.map((k) => b.items.find((x) => x.k === k || x.butir === k)).filter(Boolean);
  return `<a class="bab-card${b.active ? '' : ' soon'}" href="#/bab/${b.key}" style="--i:${i}">
    <div class="bc-top"><span class="bc-ico">${ic(b.icon)}</span>${b.active ? '' : '<span class="chip soon">Segera</span>'}</div>
    <b class="bc-name">${esc(b.name)}</b>
    <p class="bc-desc">${esc(b.desc)}</p>
    <div class="bc-pop">${pops.map((x) => `<span>${ic(x.icon)}${esc(x.n)}</span>`).join('')}</div>
    <div class="bc-foot"><span>${b.count} ${b.active ? 'jenis satuan biaya' : 'butir'}</span></div>
  </a>`;
}
// Bab yang paling sering dibuka: kartu lebih besar dengan tautan langsung ke tabel yang paling dicari
function babFeature(b, i) {
  const links = SHORTCUTS.map((k) => b.items.find((x) => x.k === k)).filter(Boolean);
  return `<div class="bab-card feat" style="--i:${i}">
    <a class="feat-head" href="#/bab/${b.key}">
      <span class="bc-ico">${ic(b.icon)}</span>
      <span class="feat-tx"><b class="bc-name">${esc(b.name)}</b><span class="bc-desc">${esc(b.desc)}</span></span>
    </a>
    <div class="feat-links">${links.map((x) => `<a href="${x.href}">${ic(x.icon)}<span class="fl-tx"><b>${esc(x.n)}</b>${x.desc ? `<small>${esc(x.desc)}</small>` : ''}</span></a>`).join('')}</div>
    <a class="bc-foot feat-all" href="#/bab/${b.key}">Semua ${b.count} jenis satuan biaya perjalanan dinas</a>
  </div>`;
}
// Rekomendasi pengisi Akses cepat bila favorit belum 8
const HOME_RECS = ['uh-dn', 'penginapan', 'tiket-dn', 'taksi', 'rapat', 'honor-narasumber', 'konsumsi-rapat', 'uang-makan'];
function viewHome() {
  const recent = store.get('recent', []).map(entry).filter(Boolean).slice(0, 5);
  const fav = saved().map(entry).filter(Boolean).slice(0, 8);
  const rec = HOME_RECS.map(entry).filter((e) => e && !fav.some((f) => f.key === e.key)).slice(0, 8 - fav.length);
  const qa = (e, isFav) => {
    const b = S.butir[e.butir];
    return `<a class="qa${isFav ? ' fav' : ''}" href="#/b/${e.butir}?t=${e.table}"><span class="qa-ico">${ic(e.icon)}</span><span class="qa-tx"><b>${esc(e.name)}</b><small title="${esc(lampShort(b))}">${isFav ? `${ic('star')} Favorit` : 'Rekomendasi'}</small></span></a>`;
  };
  const tools = [
    { h: '#/rute', i: 'signpost', t: 'Buat Perjalanan', d: 'Dari kota X ke kota Y, semua satuan biaya langsung muncul' },
    { h: '#/hitung', i: 'calculator', t: 'Kalkulator Perjadin', d: 'Perkiraan biaya dari tujuan, lama, dan pelaksana; unduh PDF' },
    { h: '#/daerah', i: 'map', t: 'Biaya Per Provinsi', d: 'Semua satuan biaya satu provinsi, bisa dibandingkan' },
  ];
  return `
  <section class="hero hero-u">
    <h1>Cari satuan biaya ${tip(`Baca ${Y.y === 2026 ? 'PMK 32/2025' : 'PMK 54/2026 dan KMK 296/2026'} tanpa membuka PDF. Semua angka diambil dari tabel ${Y.srcKind} dan dicek silang.`)}</h1>
    <label class="hero-search" for="hq">${ic('search')}<input id="hq" type="search" placeholder="Cari satuan biaya, provinsi, kota, atau aturan…" autocomplete="off" enterkeyhint="search"><kbd class="hide-sm">${isMac ? '⌘' : 'Ctrl'} K</kbd></label>
    <div class="hero-tags">${HOME_HINTS.map((h) => `<a href="#/cari?q=${encodeURIComponent(h)}" data-q="${esc(h)}">${esc(h)}</a>`).join('')}</div>
  </section>
  <h2 class="sec">${ic('star')} Akses cepat ${tip(`Favorit Anda tampil di sini (maksimal 8, yang terbaru dulu). Bila belum 8, sisanya diisi rekomendasi. Tambah favorit dengan tombol ${ic('star')} Jadikan favorit di halaman satuan biaya.`)}${fav.length ? `<a class="sec-more" href="#/tersimpan">Semua favorit (${saved().length})</a>` : ''}</h2>
  <div class="qa-grid">${fav.map((e) => qa(e, true)).join('')}${rec.map((e) => qa(e, false)).join('')}</div>
  <h2 class="sec">${ic('calculator')} Alat bantu <a class="sec-more" href="#/alat">Semua alat bantu</a></h2>
  <div class="ht-grid">${tools.map((t) => `<a class="ht" href="${t.h}"><span class="tool-ico">${ic(t.i)}</span><span class="ht-tx"><b>${t.t}</b><small>${t.d}</small></span></a>`).join('')}</div>
  ${recent.length ? `<h2 class="sec">${ic('history')} Terakhir dilihat</h2><div class="card list">${recent.map(entryRow).join('')}</div>` : ''}
`;
}
function afterHome() {
  const hq = $('#hq');
  hq.addEventListener('input', () => {
    if (isDesk()) { const v = hq.value; hq.value = ''; openPalette(v); }
    else location.hash = '#/cari?q=' + encodeURIComponent(hq.value);
  });
  hq.addEventListener('focus', () => { if (isDesk()) { hq.blur(); openPalette(''); } });
  $$('.hero-tags [data-q]').forEach((a) => a.addEventListener('click', (e) => { if (isDesk()) { e.preventDefault(); openPalette(a.dataset.q); } }));
}
function entryRow(e) {
  const b = S.butir[e.butir];
  return `<a class="li" href="#/b/${e.butir}?t=${e.table}" title="${esc(e.desc)}"><span class="li-ico">${ic(e.icon)}</span><div class="grow"><div class="t">${esc(e.name)}</div></div><span class="chip ${SIFAT[b.sifat].cls} hide-sm">${SIFAT[b.sifat].label}</span><span class="li-ref hide-sm">${lampShort(b)}</span>${ic('chev', 'chev')}</a>`;
}

/* ---------------- Jelajah (HP) ---------------- */
function viewJelajah() {
  const babs = BABS.map((b) => `<a class="li bab-li${b.active ? '' : ' soon'}" href="#/bab/${b.key}"><span class="li-ico big">${ic(b.icon)}</span><div class="grow"><div class="t">${esc(b.name)}</div><div class="d">${esc(b.desc)}</div></div>${b.active ? `<span class="chip ok">${b.count} jenis</span>` : '<span class="chip soon">Segera</span>'}${ic('chev', 'chev')}</a>`).join('');
  const refs = REF_LINKS.map((r) => `<a class="li" href="${r.h}"><span class="li-ico">${ic(r.icon)}</span><div class="grow"><div class="t">${esc(r.n)}</div></div>${ic('chev', 'chev')}</a>`).join('');
  return `
  <div class="page-head"><h1 class="title">Jelajah</h1><p class="subtitle">Satuan biaya dikelompokkan per bab, mengikuti kelompok dalam ${Y.src}.</p></div>
  <div class="group-title">Bab satuan biaya</div>
  <div class="card list">${babs}</div>
  <div class="group-title">Referensi</div>
  <div class="card list">${refs}</div>`;
}

/* ---------------- Halaman bab ---------------- */
function viewBab(bab) {
  const butirs = [...new Set(bab.items.map((x) => x.butir))].map((id) => S.butir[id]);
  const nBT = butirs.filter((b) => b.sifat === 'BT').length;
  const card = (it, i) => {
    const b = S.butir[it.butir];
    return `<a class="ent${it.active ? '' : ' off'}" href="${it.href}" style="--i:${i}">
      <span class="ent-ico">${ic(it.icon)}</span>
      <span class="ent-tx"><b>${esc(it.full || it.n)}</b><small>${esc(it.desc || b.title)}</small>
      <span class="ent-meta"><span class="chip ${SIFAT[b.sifat].cls}">${SIFAT[b.sifat].label}</span><span class="li-ref">${lampShort(b)}</span></span></span>
    </a>`;
  };
  let n = 0;
  const groups = bab.groups.map((g) => `${g.t ? `<div class="group-title">${esc(g.t)} <span class="count">${g.items.length}</span></div>` : ''}<div class="ent-grid">${g.items.map((it) => card(it, n++)).join('')}</div>`).join('');
  const tools = bab.key === 'perjadin' ? `<div class="bab-tools">
      <a href="#/rute">${ic('signpost')}<span><b>Buat perjalanan</b><small>Kota X ke kota Y</small></span></a>
      <a href="#/daerah">${ic('map')}<span><b>Biaya per provinsi</b><small>Semua biaya, bisa dibandingkan</small></span></a>
      <a href="#/hitung">${ic('calculator')}<span><b>Kalkulator perjadin</b><small>Perkiraan biaya + PDF</small></span></a>
      <a href="#/daerah/ln">${ic('globe')}<span><b>Luar negeri</b><small>Per negara & kota</small></span></a>
    </div>` : '';
  const html = `
  <div class="page-head bab-head">
    <div class="crumb"><a href="#/jelajah">Jelajah</a><span class="sep">›</span>${esc(bab.name)}</div>
    <div class="bab-title"><span class="bab-ico">${ic(bab.icon)}</span><div><h1 class="title">${esc(bab.name)}</h1><p class="bab-desc">${esc(bab.desc)}</p></div></div>
    <div class="chips">${bab.active ? `<span class="chip">${bab.count} jenis satuan biaya</span>` : ''}<span class="chip">${butirs.length} butir ${Y.srcKind}</span>${nBT ? `<span class="chip bt">${nBT} batas tertinggi</span>` : ''}${butirs.length - nBT ? `<span class="chip dl">${butirs.length - nBT} dapat dilampaui</span>` : ''}</div>
  </div>
  ${bab.active ? '' : `<div class="callout soon-call">${ic('clock')}<div><b>Segera hadir.</b> Bab ini belum dibuka pada tahap 1 (perjalanan dinas). Datanya sudah diekstrak dari ${Y.src} dan akan diaktifkan pada tahap berikutnya. Daftar butirnya bisa dilihat di bawah.</div></div>`}
  ${tools}
  ${groups}`;
  return { html };
}

/* ---------------- Tabel ---------------- */
function cellVal(t, r, i) {
  if (r.n && r.n[i] != null) return money(t, r.n[i], r.cu || t.cur);
  return esc(r.v[i]);
}

// Cocokkan kata kunci ke nama kabupaten/kota (data wilayah), kembalikan tempat beserta provinsinya
function cityToProv(toks) {
  if (!W.list || !toks.length || toks.join('').length < 3) return [];
  // "kab"/"kabupaten"/"kota" dipakai sebagai penyaring jenis, bukan bagian nama
  const kind = toks.some((t) => t === 'kab' || t === 'kabupaten') ? 'kab' : toks.includes('kota') ? 'kota' : null;
  const name = toks.filter((t) => !['kab', 'kabupaten', 'kota'].includes(t));
  if (!name.length || name.join('').length < 3) return [];
  const q = name.join(' ');
  const hitP = (words) => name.every((tk) => words.some((w) => w.startsWith(tk)));
  const out = [];
  for (const it of W.list) {
    if (it.t === 'Provinsi' || it.id === 'jakarta' || !it.kind) continue;
    if (kind && it.kind !== kind) continue;
    const pv = S.prov[it.p];
    if (hitP(norm([pv.nama, ...(pv.alias || [])].join(' ')).split(' '))) continue; // nama provinsi sudah cocok sendiri
    const nm = norm(it.n.replace(/^(Kab\.|Kota|Kabupaten)\s+/i, ''));
    const als = (it.al || []).map(norm);
    if (hitP(nm.split(' ')) || als.some((a) => hitP(a.split(' ')))) out.push({ n: it.n, p: it.p, exact: nm === q || als.includes(q) });
  }
  // Bila ada yang persis sama (nama atau sebutan, mis. "solo"), tampilkan itu saja.
  // Bila kata kunci persis nama provinsi (mis. "bali"), kota yang hanya mirip awalannya diabaikan.
  const provExact = S.provList.some((pv) => [pv.nama, ...(pv.alias || [])].some((x) => norm(x) === q));
  return out.some((x) => x.exact) || provExact ? out.filter((x) => x.exact) : out;
}
function renderTable(t, opt = {}) {
  const vc = new Set(valueCols(t));
  const uc = unitCol(t);
  const hideCols = new Set();
  if (uc && uc.unit) hideCols.add(uc.i);
  const cols = t.cols.map((c, i) => ({ c, i })).filter((x) => !hideCols.has(x.i));
  let rows = opt.rows || t.rows;
  const f = norm(opt.filter || '');
  let cityHits = [];
  if (f) {
    const toks = f.split(' ');
    // Tabel per provinsi: kata kunci kabupaten/kota ikut menampilkan baris provinsinya
    const provRows = opt.cityToProv && rows.some((r) => r.v && r.p);
    if (provRows) cityHits = cityToProv(toks);
    const hitProv = new Set(cityHits.map((x) => x.p));
    // singkatan provinsi (jatim, sumut, ntt, …)
    if (provRows) for (const pv of S.provList) if (toks.every((tk) => norm((pv.alias || []).join(' ')).split(' ').some((w) => w.startsWith(tk)))) hitProv.add(pv.id);
    const keep = [];
    let pendingGroup = null;
    for (const r of rows) {
      if (r.g) { pendingGroup = r; continue; }
      const hay = norm(r.v.join(' ') + ' ' + (pendingGroup ? pendingGroup.g : ''));
      if ((r.p && hitProv.has(r.p)) || toks.every((tk) => hay.split(' ').some((w) => w.startsWith(tk)))) {
        if (pendingGroup && !keep.includes(pendingGroup)) keep.push(pendingGroup);
        keep.push(r);
      }
    }
    rows = keep;
  }
  const hasGroups = rows.some((r) => r.g);
  const sortable = !hasGroups && opt.sortable !== false;
  if (opt.sort && sortable) {
    const { i, dir } = opt.sort;
    rows = [...rows].sort((a, b) => {
      const x = a.n?.[i] ?? a.v[i]; const y = b.n?.[i] ?? b.v[i];
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'id')) * dir;
    });
  }
  const hasCode = /^no$/i.test(t.cols[0]);
  const head = cols.map((x, k) => {
    const cls = [vc.has(x.i) ? 'n' : '', sortable && x.i > 0 ? 'sortable' : '', opt.sort && opt.sort.i === x.i ? (opt.sort.dir > 0 ? 'sorted-asc' : 'sorted-desc') : '', k === 1 ? 'sticky-col' : ''].join(' ');
    return `<th class="${cls}${x.i === 0 && hasCode ? ' code' : ''}" data-col="${x.i}">${esc(x.i === 0 && hasCode ? 'No' : shortCol(x.c))}</th>`;
  }).join('');
  const nCols = cols.length;
  const gDepth = rows.filter((r) => r.g).map((r) => r.c.split('.').length);
  const gMin = gDepth.length ? Math.min(...gDepth) : 0;
  const unitIdx = new Set(t.cols.map((c, i) => (/satuan/i.test(c) ? i : -1)).filter((i) => i >= 0));
  const UN = Object.fromEntries((S.data.singkatan || []).map((x) => [x[0], x[1]]));
  const body = rows.length ? rows.map((r) => {
    if (r.g) return `<tr class="grp g${Math.min(3, r.c.split('.').length - gMin)}"><td colspan="${nCols}"><span class="grp-in"><span class="gc">${esc(r.c)}</span>${esc(r.g)}</span></td></tr>`;
    const hl = opt.hl && r.c === opt.hl ? ' class="hl" id="hlrow"' : '';
    return `<tr${hl} data-code="${esc(r.c)}">${cols.map((x, k) => {
      if (x.i === 0 && hasCode) return `<td class="code">${esc(r.v[0] || '–')}</td>`;
      if (vc.has(x.i)) return `<td class="n">${cellVal(t, r, x.i)}</td>`;
      if (unitIdx.has(x.i)) return `<td class="unit">${UN[r.v[x.i]] ? `<abbr title="${esc(UN[r.v[x.i]])}">${esc(r.v[x.i])}</abbr>` : esc(r.v[x.i])}</td>`;
      return `<td class="${k === 1 ? 'lbl sticky-col' : 'lbl'}">${esc(r.v[x.i])}</td>`;
    }).join('')}</tr>`;
  }).join('') : `<tr><td colspan="${nCols}" class="empty">Tidak ada baris yang cocok.</td></tr>`;
  const meta = [];
  if (uc && uc.unit) meta.push(`Satuan: <b>${esc(uc.unit)}</b>${UN[uc.unit] ? ' (' + UN[uc.unit] + ')' : ''}`);
  if (t.cur === 'USD') meta.push('Nilai dalam <b>US$</b>');
  else if (rows.some((r) => r.cu === 'USD')) meta.push('Sebagian nilai dalam <b>US$</b>');
  const dataRows = rows.filter((r) => r.v).length;
  meta.push(`${dataRows} baris`);
  const hint = cityHits.length ? `<div class="city-hint">${ic('map-pin')}<div>${cityHits.slice(0, 4).map((x) => `<b>${esc(x.n)}</b> ada di <b>${esc(S.prov[x.p].nama)}</b>`).join('; ')}${cityHits.length > 4 ? `; dan ${cityHits.length - 4} lainnya` : ''}. Baris provinsinya ditampilkan.</div></div>` : '';
  return `${hint}<div class="tbl-meta">${meta.join('<span>·</span>')}</div>
  <div class="tbl-wrap"><table class="t${hasCode ? '' : ' nocode'}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function scrollHint(host) {
  const w = host.querySelector('.tbl-wrap');
  if (w && w.scrollWidth > w.clientWidth + 4) {
    const m = host.querySelector('.tbl-meta');
    if (m && !m.querySelector('.swipe')) m.insertAdjacentHTML('beforeend', '<span class="swipe">· geser tabel ke samping ›</span>');
  }
}

/* ---------------- Halaman butir ---------------- */
function renderReg(blocks, hlTokens = []) {
  const mk = (s) => {
    let h = esc(s);
    for (const t of hlTokens) if (t.length >= 3) h = h.replace(new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>');
    return h;
  };
  return blocks.map((bl) => {
    const lv = Math.min(bl.lvl || 0, 4);
    if (bl.t === 'h') return `<p class="blk h"><span class="m">${esc(bl.m)}</span>${mk(bl.x)}</p>`;
    if (bl.t === 'li') return `<p class="blk l${lv + 1}"><span class="m">${esc(bl.m)}</span>${mk(bl.x)}</p>`;
    return `<p class="blk${lv ? ' l' + lv : ''}">${mk(bl.x)}</p>`;
  }).join('');
}

function viewButir(id, params, anchor) {
  const b = S.butir[id];
  if (!b) return { html: `<div class="empty">Butir tidak ditemukan.</div>` };
  if (!b.active) {
    const bb = babOfButir(id);
    const it = bb?.items.find((x) => x.butir === id);
    return { html: `<div class="page-head"><div class="crumb"><a href="#/bab/${bb.key}">${esc(bb.name)}</a></div>
      <div class="bab-title"><span class="bab-ico">${ic(it?.icon || bb.icon)}</span><div><h1 class="title">${esc(it?.n || b.title)}</h1><p class="bab-desc">${esc(b.title)}</p></div></div>
      <div class="chips">${sifatChipTip(b)}${refChip(b)}<span class="chip soon">Segera hadir</span></div></div>
      <div class="callout soon-call">${ic('clock')}<div><b>Segera hadir.</b> Butir ini belum dibuka pada tahap 1 (perjalanan dinas). Tabel dan penjelasannya akan tampil saat bab ${esc(bb.name)} diaktifkan.</div></div>
      <div class="actions" style="margin-top:14px"><a class="btn" href="#/bab/${bb.key}">${ic(bb.icon)} Lihat bab ${esc(bb.name)}</a>${pdfBtn(b)}</div>` };
  }
  const ents = entriesOf(id);
  let ti = Math.max(0, Math.min(Number(params.t || 0), b.tables.length - 1));
  let tier = params.tier != null ? Number(params.tier) : null;
  const e = ents.find((x) => x.table === ti) || ents[0];
  pushRecent(e.key);
  const bab = babOfButir(id);
  const bgrp = bab ? bab.groups.find((gg) => gg.items.some((x) => x.butir === id && !x.also)) : null;
  const hlTokens = params.hl ? norm(params.hl).split(' ') : [];

  // Tab
  let tabs = '';
  let tableHtml = '';
  let tools = '';
  const state = { filter: params.q || '', sort: null, prov: params.p || '' };
  if (id === 'L1-29') {
    const tiers = rapatTiers();
    if (tier == null) {
      tier = 2;
      if (params.r) { const k = tiers.findIndex((x) => x.rows.some((r) => r.c === params.r)); if (k >= 0) tier = k; }
      if (ti === 1) tier = 3;
    }
    const labels = ['Menteri/Wamen', 'Eselon I–II/JF Utama', 'Eselon III/JF Madya ke bawah', 'Uang Harian Fullboard'];
    tabs = `<div class="tabs">${labels.map((l, k) => `<button class="tab${k === tier ? ' on' : ''}" data-tier="${k}">${l}</button>`).join('')}</div>`;
  } else if (ents.length > 1) {
    tabs = `<div class="tabs">${ents.map((x) => `<button class="tab${x.table === ti ? ' on' : ''}" data-t="${x.table}">${esc(x.tab || x.name)}</button>`).join('')}</div>`;
  }

  const big = b.tables[ti].rows.length > 12;
  const provTable = b.tables[ti].rows.some((r) => r.p) && !['L2-2', 'L2-3', 'L2-6'].includes(id);
  const effCtl = `<div class="eff-ctl"><label for="effIn">Dibayar</label><span class="eff-box"><input id="effIn" type="text" inputmode="decimal" autocomplete="off" maxlength="6" value="100" aria-describedby="effHelp"><span>%</span></span>${tip('Untuk simulasi efisiensi, misalnya kebijakan pemotongan perjalanan dinas. Isi persentase yang dibayar (1–100); semua angka di tabel ini dihitung ulang dan besaran SBM aslinya tetap tampil dicoret di bawahnya. Tersimpan di perangkat ini per tabel dan per tahun anggaran, dan ikut dipakai di halaman Rute, Daerah, dan Bandingkan. Besaran resmi SBM tidak berubah.')}</div>`;
  if (id === 'L2-2') {
    tools = `<div class="tbl-tools"><select class="sel" id="provSel"><option value="">Semua provinsi (31)</option>${[...new Set(b.tables[0].rows.filter((r) => r.p).map((r) => r.p))].map((p) => `<option value="${p}"${p === state.prov ? ' selected' : ''}>${esc(S.prov[p].nama)}</option>`).join('')}</select><label class="field">${ic('search')}<input id="tblq" type="search" placeholder="Cari kabupaten/kota…" value="${esc(state.filter)}"></label>${effCtl}</div>`;
  } else if (id === 'L2-6') {
    tools = `<div class="tbl-tools"><label class="field">${ic('search')}<input id="tblq" type="search" placeholder="Cari kota, mis. surabaya atau jakarta makassar…" value="${esc(state.filter)}"></label>${effCtl}</div>`;
  } else if (big && !(id === 'L1-29')) {
    tools = `<div class="tbl-tools"><label class="field">${ic('search')}<input id="tblq" type="search" placeholder="${provTable ? 'Cari provinsi atau kabupaten/kota, mis. surakarta…' : 'Saring baris tabel…'}" value="${esc(state.filter)}"></label>${effCtl}</div>`;
  } else if (id === 'L1-29') {
    tools = `<div class="tbl-tools" id="rapatTools"><label class="field">${ic('search')}<input id="tblq" type="search" placeholder="Cari provinsi atau kabupaten/kota…" value="${esc(state.filter)}"></label>${effCtl}</div>`;
  } else if (valueCols(b.tables[ti]).length) {
    tools = `<div class="tbl-tools">${effCtl}</div>`;
  }

  const draw = () => {
    let t = b.tables[ti];
    let rows = null;
    let filter = state.filter;
    if (id === 'L1-29') {
      if (tier === 3) { t = b.tables[1]; rows = t.rows; }
      else { t = b.tables[0]; rows = rapatTiers()[tier].rows; }
    }
    if (id === 'L2-2' && state.prov) {
      rows = []; let take = false;
      for (const r of t.rows) { if (r.g) take = r.p === state.prov; if (take) rows.push(r); }
    }
    if (id === 'L2-6' && filter) {
      // pencocokan dua arah antar kota
      const toks = norm(filter).split(' ');
      rows = t.rows.filter((r) => r.v && toks.every((tk) => norm(r.v[1] + ' ' + r.v[2]).split(' ').some((w) => w.startsWith(tk))));
      filter = '';
    }
    const host = $('#tblHost');
    state.t = t;
    const inp = $('#effIn');
    if (inp && document.activeElement !== inp) inp.value = String(effPct(t)).replace('.', ',');
    const p = effPct(t);
    const ctl = $('.eff-ctl');
    if (ctl) ctl.classList.toggle('on', p < 100);
    const effNote = p < 100 ? `<div class="eff-note" role="status">${ic('alert')}<div><b>Ditampilkan ${pctTxt(p)} dari besaran SBM.</b> Angka dicoret di bawahnya adalah besaran resmi ${Y.src}. Dibulatkan ke rupiah terdekat.</div><button type="button" class="btn sm" id="effReset">Kembali ke 100%</button></div>` : '';
    host.innerHTML = effNote + renderTable(t, { rows, filter, sort: state.sort, hl: params.r, cityToProv: !['L2-2', 'L2-3', 'L2-6'].includes(id) });
    const rs = $('#effReset');
    if (rs) rs.onclick = () => { setEffPct(t, 100); draw(); toast('Kembali ke 100%'); };
    scrollHint(host);
    $$('th.sortable', host).forEach((th) => th.onclick = () => {
      const i = Number(th.dataset.col);
      state.sort = state.sort && state.sort.i === i ? { i, dir: -state.sort.dir } : { i, dir: 1 };
      draw();
    });
  };

  const tierNote = '';
  if (id === 'L1-29') tabs = tabs.replace(/<\/div>$/, `<span class="tabs-tip">${tip('Tarif fullboard dihitung untuk 1 kamar berdua. Untuk eselon II/JF utama ke atas (1 kamar sendiri), indeks paling tinggi 1,5 kali tarif fullboard.')}</span></div>`);
  const pts = [...new Set(ents.flatMap((x) => x.points || []))];
  const notes = [...new Set(ents.map((x) => x.appNote).filter(Boolean))];
  const points = pts.length ? fold('Poin penting', `<ul class="points">${pts.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>${notes.map((n) => `<div class="callout warn" style="margin-top:12px">${ic('alert')}<div>${esc(n)}</div></div>`).join('')}<div class="points-note">Diringkas dari Penjelasan ${Y.src}.</div>`, { meta: pts.length + ' poin' }) : '';
  const openText = !!(params.hl || anchor);
  const pen = fold(`Penjelasan · ${Y.src}`, `<div class="reg">${renderReg(b.pen, hlTokens)}</div><div class="src">${ref(b)} (Penjelasan atas Lampiran ${b.lamp === 1 ? 'I' : 'II'})</div>`, { id: 'pen', open: openText && anchor !== 'def' });
  const def = !b.def ? '' : fold(`Definisi · ${Y.norm}`, `<div class="def">${renderReg([{ t: 'p', x: b.def }], hlTokens)}</div><div class="src">Lampiran ${b.lamp === 1 ? 'I' : 'II'} ${Y.norm} angka ${b.no}: ${esc(b.title)}</div>`, { id: 'def', open: openText && anchor === 'def' });
  const others = bgrp ? bgrp.items.filter((x) => x.butir !== id && x.active) : [];
  const relTitle = bgrp && bgrp.t ? `Lainnya di ${esc(bab.name)} · ${esc(bgrp.t)}` : `Lainnya di ${esc(bab ? bab.name : '')}`;
  const related = others.length ? fold(relTitle, `<div class="list">${others.map((x) => `<a class="li" href="${x.href}"><span class="li-ico">${ic(x.icon)}</span><div class="grow"><div class="t">${esc(x.full || x.n)}</div></div>${ic('chev', 'chev')}</a>`).join('')}</div>`, { meta: others.length }) : '';
  const tolOn = id in TOL && (TOL[id] === null || TOL[id].includes(ti));
  const tolFold = tolOn ? fold('Toleransi kabupaten tertentu', `<p class="fold-p">Untuk kabupaten berikut, pengusulan satuan biaya ini dapat melebihi besaran provinsinya sampai persentase yang tercantum (Catatan Umum Lampiran ${b.lamp === 1 ? `I butir ${Y.tolL1}` : 'II butir 3'}).</p><table class="plain"><thead><tr><th>Provinsi</th><th>Kabupaten</th><th style="text-align:right">Toleransi</th></tr></thead><tbody>${S.data.toleransi.map((t) => `<tr><td>${esc(t[0])}</td><td>${esc(t[1])}</td><td style="text-align:right" class="tnum"><b>${t[2]}%</b></td></tr>`).join('')}</tbody></table>`, { meta: S.data.toleransi.length + ' kabupaten' }) : '';

  const title = id === 'L1-25' ? e.name : e.name;
  const html = `
  <div class="page-head">
    <div class="crumb">${bab ? `<a href="#/bab/${bab.key}">${esc(bab.name)}</a>` : ''}${bgrp && bgrp.t ? `<span class="sep">›</span>${esc(bgrp.t)}` : ''}</div>
    <h1 class="title">${esc(title)}</h1>
    <p class="subtitle">${esc(b.title)}</p>
    <div class="chips">${sifatChipTip(b)}${refChip(b)}</div>
    <div class="actions">
      ${pdfBtn(b)}
      <button class="btn sm${isSaved(e.key) ? ' on' : ''}" id="saveBtn">${ic('star')} <span>${isSaved(e.key) ? 'Favorit' : 'Jadikan favorit'}</span></button>
      <button class="btn sm" id="refBtn">${ic('copy')} Salin rujukan</button>
      ${navigator.share ? `<button class="btn sm" id="shareBtn">${ic('share')} Bagikan</button>` : ''}
    </div>
  </div>
  <div class="butir-layout">
    <div class="butir-main">
      ${tabs}${tierNote}${tools}
      <div id="tblHost"></div>
      <div class="grid" style="margin-top:16px">${points}${tolFold}</div>
      <div class="grid hide-wide" style="margin-top:10px">${pen}${def}</div>
      <div class="grid" style="margin-top:10px">${related}</div>
    </div>
    <aside class="butir-aside grid">${''}</aside>
  </div>`;

  const after = () => {
    // Di layar lebar, pindahkan poin penting & penjelasan ke kolom kanan
    const wide = false;
    if (wide) {
      const aside = $('.butir-aside');
      const main = $('.butir-main');
      const pts = main.querySelector('.grid');
      const reg = main.querySelector('.hide-wide');
      aside.append(...pts.children, ...reg.children);
      pts.remove(); reg.remove();
    }
    draw();
    $$('[data-t]').forEach((bt) => bt.onclick = () => { location.hash = `#/b/${id}?t=${bt.dataset.t}`; });
    $$('[data-tier]').forEach((bt) => bt.onclick = () => { tier = Number(bt.dataset.tier); $$('[data-tier]').forEach((x) => x.classList.toggle('on', x === bt)); state.sort = null; draw(); });
    const q = $('#tblq');
    if (q) q.oninput = () => { state.filter = q.value; draw(); };
    const ps = $('#provSel');
    if (ps) ps.onchange = () => { state.prov = ps.value; draw(); };
    const ei = $('#effIn');
    if (ei) {
      const apply = () => {
        const raw = ei.value.trim().replace(',', '.').replace('%', '');
        if (raw === '') return;
        const v = Number(raw);
        if (!(v > 0 && v <= 100)) { ei.setAttribute('aria-invalid', 'true'); return; }
        ei.removeAttribute('aria-invalid');
        setEffPct(state.t, v);
        draw();
      };
      let tm;
      ei.oninput = () => { clearTimeout(tm); tm = setTimeout(apply, 350); };
      ei.onchange = apply;
      ei.onkeydown = (ev) => { if (ev.key === 'Enter') { clearTimeout(tm); apply(); ei.blur(); } };
      ei.onblur = () => { if (ei.value.trim() === '' || ei.getAttribute('aria-invalid')) { ei.removeAttribute('aria-invalid'); ei.value = String(effPct(state.t)).replace('.', ','); } };
      ei.onfocus = () => ei.select();
    }
    $('#saveBtn').onclick = () => {
      const on = toggleSaved(e.key);
      $('#saveBtn').classList.toggle('on', on);
      $('#saveBtn span').textContent = on ? 'Favorit' : 'Jadikan favorit';
      toast(on ? 'Ditambahkan ke favorit' : 'Dihapus dari favorit');
    };
    $('#refBtn').onclick = () => copy(`${ref(b, { code: (params.r && b.tables[ti]?.rows.find((x) => x.c === params.r)?.v?.[0]) || params.r || b.no })} (${e.name})`, 'Rujukan disalin');
    const sh = $('#shareBtn');
    if (sh) sh.onclick = () => navigator.share({ title: `${e.name} · SBM ${Y.y}`, url: location.href }).catch(() => {});
    const hl = $('#hlrow');
    if (hl) setTimeout(() => hl.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60);
    else if (anchor) { const el = document.getElementById(anchor); if (el) setTimeout(() => el.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60); }
  };
  return { html, after };
}

/* ---------------- Cari ---------------- */
function viewCari(q) {
  return `
  <div class="page-head"><h1 class="title">Cari</h1><p class="subtitle">Ketik jenis biaya, provinsi, kota, atau kata dalam aturan.<br>Contoh: ${SEARCH_HINTS.map((h) => `<i>${esc(h)}</i>`).join(', ')}.</p></div>
  <div class="search-box">${ic('search')}<input id="q" type="search" value="${esc(q)}" placeholder="Cari di SBM ${Y.y}…" autocomplete="off" enterkeyhint="search" aria-label="Cari"><button id="qClear" aria-label="Hapus">${ic('x')}</button></div>
  <div id="results"></div>`;
}
function afterCari(q) {
  const box = $('#q');
  box.focus();
  box.setSelectionRange(box.value.length, box.value.length);
  let tmr;
  box.addEventListener('input', () => {
    clearTimeout(tmr);
    tmr = setTimeout(() => {
      history.replaceState(null, '', '#/cari?q=' + encodeURIComponent(box.value));
      updateResults(box.value);
    }, 90);
  });
  box.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { const first = $('#results a.li'); if (first) { saveQuery(box.value); location.hash = first.getAttribute('href'); } }
  });
  $('#qClear').onclick = () => { box.value = ''; history.replaceState(null, '', '#/cari'); updateResults(''); box.focus(); };
  $('#results').addEventListener('click', (ev) => { if (ev.target.closest('a')) saveQuery(box.value); });
  updateResults(q);
}
function saveQuery(q) {
  q = (q || '').trim();
  if (q.length < 2) return;
  const h = store.get('qhist', []).filter((x) => x !== q);
  h.unshift(q);
  store.set('qhist', h.slice(0, 8));
}
function updateResults(q) {
  const host = $('#results');
  if (!host) return;
  const box = $('#q');
  if (box && box.value !== q && document.activeElement !== box) box.value = q;
  if (!q.trim()) {
    const hist = store.get('qhist', []);
    host.innerHTML = `
      ${hist.length ? `<div class="res-group"><div class="res-title">Pencarian terakhir</div><div class="hint-list">${hist.map((h) => `<a href="#/cari?q=${encodeURIComponent(h)}">${esc(h)}</a>`).join('')}</div></div>` : ''}
      ${hist.length ? '' : '<div class="empty small">Ketik untuk mulai mencari.</div>'}`;
    return;
  }
  const r = search(q);
  const li = (x, kind) => `<a class="li" href="${x.href}"><div class="grow"><div class="t">${x.html ? x.t : esc(x.t)}</div>${x.d ? `<div class="${x.snip ? 'res-snip' : 'd'}">${x.html || x.snip ? x.d : esc(x.d)}</div>` : ''}${x.v ? `<div class="d"><b class="tnum">${x.v}</b></div>` : ''}${kind ? `<div class="chips" style="margin-top:6px">${kind}</div>` : ''}</div>${ic('chev', 'chev')}</a>`;
  let html = '';
  if (r.corrected) html += `<p class="muted small" style="margin:12px 2px 0">Menampilkan hasil untuk <b>${esc(r.corrected)}</b>.</p>`;
  if (r.best.length) html += `<div class="res-group"><div class="res-title">Langsung ke</div><div class="card list res-best">${r.best.slice(0, 8).map((x) => li(x, x.kind ? `<span class="chip">${esc(x.kind)}</span>` : '')).join('')}</div></div>`;
  if (r.menus.length) html += `<div class="res-group"><div class="res-title">Jenis satuan biaya</div><div class="card list">${r.menus.map((x) => li(x, sifatChip(x.ref) + refChip(x.ref))).join('')}</div></div>`;
  if (r.rows.length) html += `<div class="res-group"><div class="res-title">Baris tabel <span class="count muted">(${r.rows.length >= 40 ? '40+' : r.rows.length})</span></div><div class="card list">${r.rows.slice(0, 25).map((x) => li(x)).join('')}</div></div>`;
  if (r.pens.length) html += `<div class="res-group"><div class="res-title">Dalam teks aturan</div><div class="card list">${r.pens.map((x) => li({ ...x, snip: true }, `<span class="chip">${esc(x.src)}</span>`)).join('')}</div></div>`;
  if (r.soon.length) html += `<div class="res-group"><div class="res-title">Belum tersedia di versi ini</div><div class="card list">${r.soon.map((b) => `<a class="li soon" href="#/b/${b.id}"><div class="grow"><div class="t">${esc(b.title)}</div><div class="d">${esc(babByKel(b.kel)?.name || '')} · ${lampShort(b)}</div></div><span class="chip soon">Segera</span></a>`).join('')}</div></div>`;
  if (!html || (!r.best.length && !r.menus.length && !r.rows.length && !r.pens.length && !r.soon.length)) {
    html += `<div class="empty">Tidak ada hasil untuk <b>${esc(q)}</b>.<br><span class="small">Coba kata lain, mis. nama provinsi, kota, atau jenis biaya.</span></div>`;
  }
  host.innerHTML = html;
}

/* ---------------- Daerah ---------------- */
function daerahSeg(mode) {
  return `<div class="seg"><a href="#/daerah" class="${mode === 'dn' ? 'on' : ''}">Dalam negeri (per provinsi)</a><a href="#/daerah/ln" class="${mode === 'ln' ? 'on' : ''}">Luar negeri (per negara)</a></div>`;
}

/* ---------------- Rute ---------------- */
function placeField(id, label, value, placeholder) {
  return `<div class="pf"><label for="${id}">${label}</label><div class="pf-box">${ic('pin')}<input id="${id}" type="text" autocomplete="off" spellcheck="false" placeholder="${esc(placeholder)}" value="${esc(value)}"><button class="pf-clear" data-clear="${id}" aria-label="Hapus">${ic('x')}</button></div><div class="ac" id="${id}-ac" role="listbox"></div></div>`;
}
function routeForm(dari, ke, compact = false) {
  return `<div class="route-form${compact ? ' compact' : ''}">
    ${placeField('rDari', 'Dari', placeLabel(dari), 'Kota/kabupaten/provinsi asal')}
    <button class="icon-btn swap" id="rSwap" aria-label="Tukar asal dan tujuan" title="Tukar">${ic('compare')}</button>
    ${placeField('rKe', 'Ke', ke ? placeLabel(ke) : '', 'Ketik kota tujuan, mis. Surabaya, Bojonegoro, Jawa Timur…')}
  </div>`;
}
function attachAC(inputId, onPick, sugg = suggest) {
  const inp = $('#' + inputId);
  const box = $('#' + inputId + '-ac');
  let items = [], idx = -1;
  const render = () => {
    if (!items.length) { box.innerHTML = inp.value.trim() ? '<div class="ac-empty">Tidak ditemukan</div>' : ''; box.classList.toggle('open', !!inp.value.trim()); return; }
    box.innerHTML = items.map((it, i) => `<button type="button" class="ac-it${i === idx ? ' on' : ''}" data-i="${i}"><span class="ac-t">${esc(it.n)}${it.air ? ' <span class="ac-air" title="Ada di tabel tiket pesawat ${Y.srcKind}">' + ic('plane') + '</span>' : ''}</span><span class="ac-s">${esc(it.sub)}</span><span class="ac-b">${esc(it.t)}</span></button>`).join('');
    box.classList.add('open');
  };
  inp.addEventListener('input', () => { items = sugg(inp.value); idx = items.length ? 0 : -1; render(); });
  inp.addEventListener('focus', () => { inp.select(); if (inp.value.trim()) { items = sugg(inp.value); idx = 0; render(); } });
  inp.addEventListener('keydown', (e) => {
    if (!box.classList.contains('open')) return;
    if (e.key === 'ArrowDown') { idx = Math.min(items.length - 1, idx + 1); render(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { idx = Math.max(0, idx - 1); render(); e.preventDefault(); }
    else if (e.key === 'Enter' && items[idx]) { e.preventDefault(); pick(items[idx]); }
    else if (e.key === 'Escape') { box.classList.remove('open'); }
  });
  inp.addEventListener('blur', () => setTimeout(() => box.classList.remove('open'), 160));
  box.addEventListener('mousedown', (e) => e.preventDefault());
  box.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) pick(items[Number(b.dataset.i)]); });
  const pick = (it) => { inp.value = it.n; box.classList.remove('open'); inp.blur(); onPick(it); };
}
function viewRute(params) {
  const dari = params.dari || 'jakarta';
  const ke = params.ke || '';
  const O = resolve(dari), D = ke ? resolve(ke) : null;
  const go = (d, k) => { location.hash = `#/rute?dari=${encodeURIComponent(d)}${k ? '&ke=' + encodeURIComponent(k) : ''}`; };
  const hints = routeHints();
  const html = `
  <div class="page-head"><h1 class="title">Buat Perjalanan</h1><p class="subtitle">Pilih kota asal dan tujuan. Semua satuan biaya yang relevan muncul berurutan: taksi, tiket, transport darat, uang harian, penginapan. Rekomendasi mencakup 514 kabupaten/kota dan 38 provinsi. Contoh tujuan: ${hints.map((h) => esc(h.n)).join(', ')}.</p></div>
  <div class="card card-pad">${routeForm(dari, ke)}
  </div>
  <div id="routeHost" style="margin-top:16px">${O && D ? effNotice() + routeHtml(O, D) : `<div class="empty small">Pilih tujuan untuk melihat satuan biayanya.</div>`}</div>`;
  const after = () => {
    attachAC('rDari', (it) => go(it.id, ke));
    attachAC('rKe', (it) => go(dari, it.id));
    $('#rSwap').onclick = () => { if (ke) go(ke, dari); };
    $$('[data-clear]').forEach((b) => b.onclick = () => { const i = $('#' + b.dataset.clear); i.value = ''; i.focus(); i.dispatchEvent(new Event('input')); });
    if (!ke) setTimeout(() => $('#rKe').focus(), 50);
  };
  return { html, after };
}

function viewDaerah(mode, params) {
  const seg = daerahSeg(mode);
  if (mode === 'dn') {
    const html = `
    <div class="page-head"><h1 class="title">Biaya Per Provinsi</h1><p class="subtitle">Pilih provinsi untuk melihat semua satuan biaya SBM yang ditetapkan per provinsi, dikelompokkan per jenis biaya. Di halaman provinsi, Anda bisa menambahkan sampai 2 provinsi pembanding.</p></div>
    ${seg}
    <div class="tbl-tools"><label class="field">${ic('search')}<input id="pq" type="search" placeholder="Cari provinsi atau kabupaten/kota, mis. jatim, surakarta…"></label></div>
    <div id="provHint"></div>
    <div class="prov-grid" id="provGrid">${S.provList.map((p) => `<a class="prov" href="#/daerah/p/${p.id}" data-s="${esc(norm([p.nama, ...p.alias, ...p.kota].join(' ')))}"><b>${esc(p.nama)}</b><small>${esc(p.kota[0])}</small></a>`).join('')}</div>`;
    const after = () => {
      const pq = $('#pq');
      pq.oninput = () => {
        const toks = norm(pq.value).split(' ').filter(Boolean);
        const hits = cityToProv(toks);
        const viaCity = new Set(hits.map((x) => x.p));
        $$('#provGrid .prov').forEach((a) => { const id = a.getAttribute('href').split('/').pop(); a.style.display = !toks.length || viaCity.has(id) || toks.every((t) => a.dataset.s.split(' ').some((w) => w.startsWith(t))) ? '' : 'none'; });
        $('#provHint').innerHTML = hits.length ? `<div class="city-hint">${ic('map-pin')}<div>${hits.slice(0, 4).map((x) => `<b>${esc(x.n)}</b> ada di <b>${esc(S.prov[x.p].nama)}</b>`).join('; ')}${hits.length > 4 ? `; dan ${hits.length - 4} lainnya` : ''}.</div></div>` : '';
      };
    };
    return { html, after };
  }
  const tab = params.tab === 'tiket' ? 'tiket' : 'uh';
  const b = S.butir[tab === 'uh' ? 'L1-26' : 'L2-7'];
  const html = `
  <div class="page-head"><h1 class="title">Luar Negeri</h1><p class="subtitle">Uang harian per negara dan tiket pesawat per kota tujuan, dalam US$.</p></div>
  ${seg}
  <div class="tabs"><button class="tab${tab === 'uh' ? ' on' : ''}" data-ln="uh">Uang harian per negara</button><button class="tab${tab === 'tiket' ? ' on' : ''}" data-ln="tiket">Tiket PP dari Jakarta per kota</button></div>
  <div class="tbl-tools"><label class="field">${ic('search')}<input id="lnq" type="search" placeholder="${tab === 'uh' ? 'Cari negara, mis. jepang, belanda…' : 'Cari kota, mis. tokyo, amsterdam…'}"></label><a class="btn" href="#/b/${b.id}">${ic('book')} Buka butir & penjelasan</a></div>
  <div class="chips" style="margin:-2px 0 10px">${sifatChip(b)}${refChip(b)}</div>
  <div id="lnHost"></div>`;
  const after = () => {
    const draw = (f) => { $('#lnHost').innerHTML = renderTable(b.tables[0], { filter: f, sortable: false }); scrollHint($('#lnHost')); };
    draw('');
    $('#lnq').oninput = (ev) => draw(ev.target.value);
    $$('[data-ln]').forEach((bt) => bt.onclick = () => { location.hash = `#/daerah/ln?tab=${bt.dataset.ln}`; });
  };
  return { html, after };
}

// Baris satuan biaya per provinsi, dikelompokkan per bab. Satu provinsi atau dibandingkan sampai 3.
const SPECIAL_PROV = new Set(['L2-2', 'L2-3', 'L2-6']);
function provSections(P) {
  const B = S.butir;
  const groupOf = (t) => { const out = []; let g = ''; for (const r of t.rows) { if (r.g) g = r.g; else if (r.v && r.p) out.push({ g, r }); } return out; };
  return BABS.map((bb) => {
    const blocks = [];
    const seen = new Set();
    let nasional = 0;
    for (const it of bb.items) {
      for (const e of entriesOf(it.butir)) {
        const key = e.butir + ':' + e.table;
        if (seen.has(key)) continue;
        seen.add(key);
        const b = B[e.butir];
        const t = b.tables[e.table];
        if (SPECIAL_PROV.has(e.butir)) continue;
        const pr = groupOf(t);
        if (!pr.length) { nasional++; continue; }
        const groups = [...new Set(pr.map((x) => x.g))];
        const multi = groups.length > 1 && pr.filter((x) => x.r.p === pr[0].r.p).length > 1;
        const vc = valueCols(t);
        const ui = t.cols.findIndex((c) => /^satuan$/i.test(c));
        const rows = [];
        for (const g of multi ? groups : ['']) {
          const cells = P.map((pid) => pr.find((x) => x.r.p === pid && (!multi || x.g === g))?.r || null);
          for (const i of vc) rows.push({ label: [multi ? g : '', vc.length > 1 ? shortCol(t.cols[i]) : (multi ? '' : shortCol(t.cols[i]))].filter(Boolean).join(' · '), vals: cells.map((r) => (r && r.n[i] != null ? money(t, r.n[i], r.cu || t.cur) : null)) });
        }
        const r0 = pr.find((x) => x.r.p === P[0])?.r;
        blocks.push({ e, b, t, rows, unit: ui >= 0 ? (r0 || pr[0].r).v[ui] : '', href: `#/b/${b.id}?t=${e.table}${r0 ? '&r=' + encodeURIComponent(r0.c) : ''}` });
      }
    }
    // Perjalanan dinas: tabel yang berisi banyak baris per provinsi diringkas, ditambah yang berlaku nasional
    if (bb.key === 'perjadin') {
      const range = (t, rows, col) => { const ns = rows.map((r) => r.n[col]).filter((n) => n != null); if (!ns.length) return null; const lo = Math.min(...ns), hi = Math.max(...ns); return lo === hi ? money(t, lo) : `${money(t, lo)} – ${money(t, hi)}`; };
      const tD = B['L2-2'].tables[0];
      const dRows = (pid) => tD.rows.filter((r) => r.v && r.p === pid);
      blocks.push({ e: { name: 'Transport darat dari ibu kota provinsi', icon: 'bus-front' }, b: B['L2-2'], t: tD, unit: 'Sekali jalan', href: '#/b/L2-2', rows: [{ label: 'Rentang besaran (jumlah rute)', vals: P.map((pid) => { const rs = dRows(pid); return rs.length ? `${range(tD, rs, 4)}<small class="pv-n">${rs.length} rute</small>` : null; }) }], list: P.length === 1 ? dRows(P[0]) : null, listKind: 'darat' });
      const tK = B['L2-6'].tables[0];
      const kRows = (pid) => tK.rows.filter((r) => r.v && (r.pa === pid || r.pt === pid));
      blocks.push({ e: { name: 'Tiket pesawat (PP)', icon: 'plane' }, b: B['L2-6'], t: tK, unit: 'Orang/PP', href: '#/b/L2-6', rows: [
        { label: 'Ekonomi, rentang (jumlah rute)', vals: P.map((pid) => { const rs = kRows(pid); return rs.length ? `${range(tK, rs, 4)}<small class="pv-n">${rs.length} rute</small>` : null; }) },
        { label: 'Bisnis, rentang', vals: P.map((pid) => { const rs = kRows(pid); return rs.length ? range(tK, rs, 3) : null; }) },
      ], list: P.length === 1 ? kRows(P[0]) : null, listKind: 'tiket' });
      if (P.includes('dki')) {
        const tB = B['L2-3'].tables[0];
        const bRows = tB.rows.filter((r) => r.v);
        blocks.push({ e: { name: 'Transport Jakarta ke Bodetabek', icon: 'car' }, b: B['L2-3'], t: tB, unit: 'Sekali jalan', href: '#/b/L2-3', rows: [{ label: 'Rentang besaran', vals: P.map((pid) => (pid === 'dki' ? range(tB, bRows, 4) : null)) }], list: P.length === 1 ? bRows : null, listKind: 'bode' });
      }
      const tR2 = B['L1-25'].tables[1];
      const t4 = B['L2-4'].tables[0];
      const tF = B['L1-29'].tables[1];
      const same = (v) => P.map(() => v);
      blocks.push({ e: { name: 'Berlaku nasional', icon: 'flag' }, b: null, nas: true, rows: [
        { label: 'Transpor kegiatan dalam kota (PP)', href: '#/b/L2-4', vals: same(money(t4, firstVal(t4))) },
        { label: 'Uang harian rapat fullboard', href: '#/b/L1-29?t=1', vals: same(money(tF, tF.rows.find((r) => r.v).n[3])) },
        ...tR2.rows.filter((r) => r.v).map((r) => ({ label: `Representasi ${r.v[1]} (luar kota / dalam kota)`, href: '#/b/L1-25?t=1', vals: same(`${money(tR2, r.n[3])} / ${money(tR2, r.n[4])}`) })),
      ] });
      nasional = 0;
    }
    return { bb, blocks, nasional };
  }).filter((x) => x.blocks.length);
}

function provListHtml(blk) {
  if (!blk.list || !blk.list.length) return '';
  const t = blk.t;
  const link = (code) => `#/b/${blk.b.id}?t=0&r=${encodeURIComponent(code)}`;
  let head, body;
  if (blk.listKind === 'darat') { head = '<th>Dari</th><th>Kabupaten/Kota tujuan</th><th class="n">Sekali jalan</th>'; body = blk.list.map((r) => `<tr><td>${esc(r.v[1])}</td><td><a href="${link(r.c)}">${esc(r.v[2])}</a></td><td class="n">${money(t, r.n[4])}</td></tr>`).join(''); }
  else if (blk.listKind === 'tiket') { head = '<th>Rute</th><th class="n">Bisnis</th><th class="n">Ekonomi</th>'; body = blk.list.map((r) => `<tr><td><a href="${link(r.c)}">${esc(r.v[1])} ⇄ ${esc(r.v[2])}</a></td><td class="n">${money(t, r.n[3])}</td><td class="n">${money(t, r.n[4])}</td></tr>`).join(''); }
  else { head = '<th>Tujuan</th><th class="n">Sekali jalan</th>'; body = blk.list.map((r) => `<tr><td>${esc(r.v[2])}</td><td class="n">${money(t, r.n[4])}</td></tr>`).join(''); }
  return `<details class="pv-list"><summary>Lihat ${blk.list.length} ${blk.listKind === 'tiket' ? 'rute tiket' : 'rute'}</summary><div class="scroll-list"><table class="mini"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div></details>`;
}

function viewProv(pid, params = {}) {
  const p = S.prov[pid];
  if (!p) return { html: `<div class="empty">Provinsi tidak ditemukan. <a href="#/daerah">Pilih provinsi</a></div>` };
  const vs = (params.vs || '').split(',').filter((x) => S.prov[x] && x !== pid).slice(0, 2);
  const P = [pid, ...vs];
  const cmp = P.length > 1;
  const secs = provSections(P);
  const opt = (sel, except) => S.provList.filter((x) => !except.includes(x.id) || x.id === sel).map((x) => `<option value="${x.id}"${x.id === sel ? ' selected' : ''}>${esc(x.nama)}</option>`).join('');
  const picker = `<div class="pv-pick card card-pad">
    <label class="pv-f"><span>Provinsi</span><select class="sel" data-pv="0">${opt(pid, P)}</select></label>
    ${[0, 1].map((k) => `<label class="pv-f"><span>Pembanding ${k + 1}</span><select class="sel" data-pv="${k + 1}"><option value="">Tidak ada</option>${opt(vs[k] || '', P)}</select></label>`).join('')}
    <button type="button" class="btn" id="pvAll">${ic('chevron-down')} <span>Buka semua</span></button>
  </div>`;
  const th = `<th>Satuan biaya</th>${P.map((x) => `<th class="n">${cmp ? `<a href="#/daerah/p/${x}">${esc(S.prov[x].nama)}</a>` : 'Besaran'}</th>`).join('')}`;
  const cell = (v) => `<td class="n">${v == null ? '<span class="na">Tidak tercantum</span>' : v}</td>`;
  const body = secs.map(({ bb, blocks, nasional }) => {
    const n = blocks.reduce((a, x) => a + (x.nas ? x.rows.length : 1), 0);
    const tbody = blocks.map((blk) => {
      const head = blk.nas
        ? `<tr class="grp"><td colspan="${P.length + 1}">${ic(blk.e.icon)} ${esc(blk.e.name)} <small>sama di semua provinsi</small></td></tr>`
        : `<tr class="grp"><td colspan="${P.length + 1}"><span class="pv-gt">${ic(blk.e.icon)} ${esc(blk.e.name)}</span>${blk.unit ? `<small>${esc(blk.unit)}</small>` : ''}<a class="pv-ref" href="${blk.href}">${lampShort(blk.b)} ›</a></td></tr>`;
      const rows = blk.rows.map((r) => `<tr><td class="lbl">${r.href ? `<a href="${r.href}">${esc(r.label)}</a>` : esc(r.label || 'Besaran')}</td>${r.vals.map(cell).join('')}</tr>`).join('');
      const list = provListHtml(blk);
      return head + rows + (list ? `<tr class="pv-lrow"><td colspan="${P.length + 1}">${list}</td></tr>` : '');
    }).join('');
    const nasNote = nasional ? `<p class="pv-nas">${nasional} jenis lain di bab ini berlaku nasional (sama di semua provinsi). <a href="#/bab/${bb.key}">Buka bab ${esc(bb.name)} ›</a></p>` : '';
    return `<details class="pv-grp" data-bab="${bb.key}"><summary><span class="pv-ico">${ic(bb.icon)}</span><span class="pv-st"><b>${esc(bb.name)}</b><small>${esc(bb.desc)}</small></span><span class="chip">${n} jenis</span>${ic('chevron-down', 'pv-chev')}</summary>
      <div class="pv-body"><div class="tbl-wrap pv-tbl"><table class="t pv-t${cmp ? ' cmp' : ''}"><thead><tr>${th}</tr></thead><tbody>${tbody}</tbody></table></div>${nasNote}</div></details>`;
  }).join('');
  const html = `
  <div class="page-head">
    <h1 class="title">${cmp ? 'Bandingkan ' + P.map((x) => esc(S.prov[x].nama)).join(', ') : esc(p.nama)}</h1>
    <p class="subtitle">${cmp ? 'Satuan biaya yang ditetapkan per provinsi, berdampingan.' : `Ibu kota: ${esc(p.kota[0])}.`} Dikelompokkan per jenis biaya sesuai ${Y.src}; buka kelompok untuk melihat rinciannya, dan ketuk tautan Lamp. untuk tabel lengkap serta penjelasannya.</p>
  </div>
  ${picker}
  ${effNotice()}
  <div class="pv-grps">${body}</div>`;
  const after = () => {
    const go = () => {
      const v = $$('[data-pv]').map((s) => s.value);
      const main = v[0];
      const others = [...new Set(v.slice(1).filter((x) => x && x !== main))];
      location.hash = `#/daerah/p/${main}${others.length ? '?vs=' + others.join(',') : ''}`;
    };
    $$('[data-pv]').forEach((s) => s.onchange = go);
    const all = $('#pvAll');
    const sync = () => { const open = $$('.pv-grp').every((d) => d.open); all.querySelector('span').textContent = open ? 'Tutup semua' : 'Buka semua'; all.classList.toggle('on', open); };
    all.onclick = () => { const open = !$$('.pv-grp').every((d) => d.open); $$('.pv-grp').forEach((d) => { d.open = open; }); sync(); };
    $$('.pv-grp').forEach((d) => d.addEventListener('toggle', sync));
  };
  return { html, after };
}

/* ---------------- Favorit ---------------- */
/* ---------------- Kalkulator Perjadin ---------------- */
function viewHitung() {
  if (!KP.kurs) KP.kurs = Number(store.get('kurs', 0)) || 0;
  const html = `<div class="page-head"><h1 class="title">Kalkulator Perjadin</h1><p class="subtitle">Isi tujuan surat tugas, lama perjalanan, dan pelaksananya: dalam negeri luar kota, dalam kota, atau luar negeri. Perkiraan biaya muncul dari satuan biaya SBM TA ${Y.y}, lengkap dengan rujukan tabelnya. Persentase dibayar yang diatur di tiap tabel ikut dipakai.</p></div>
  <div class="kp">${formHtml({ routeForm, placeField, placeLabel })}<div id="kpHost"></div></div>`;
  const after = () => {
    const draw = () => {
      const res = compute();
      $('.kp-form').classList.toggle('no-tiket', !(res.ready && res.hasTiket));
      $('#kpHost').innerHTML = resultHtml(res, effNotice);
      const toDk = $('[data-to-dk]');
      if (toDk) toDk.onclick = () => { KP.lingkup = 'dk'; route(); };
      const pdf = $('#kpPdf');
      if (!pdf) return;
      const make = async (btn) => {
        btn.disabled = true; const old = btn.innerHTML; btn.innerHTML = `${ic('clock')} Menyiapkan PDF…`;
        try { return await buildPdf(res); } catch (err) { console.error(err); toast('PDF gagal dibuat'); return null; } finally { btn.disabled = false; btn.innerHTML = old; }
      };
      pdf.onclick = async () => {
        const out = await make(pdf);
        if (!out) return;
        const a = document.createElement('a'); a.href = URL.createObjectURL(out.blob); a.download = out.name;
        document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
        toast('PDF diunduh');
      };
    };
    $$('[data-lingkup]').forEach((b) => b.onclick = () => { if (KP.lingkup === b.dataset.lingkup) return; KP.lingkup = b.dataset.lingkup; route(); });
    if ($('#rDari')) attachAC('rDari', (it) => { KP.dari = it.id; draw(); });
    if ($('#rKe')) attachAC('rKe', (it) => { KP.ke = it.id; draw(); });
    if ($('#rSwap')) $('#rSwap').onclick = () => { if (!KP.ke) return; [KP.dari, KP.ke] = [KP.ke, KP.dari]; $('#rDari').value = placeLabel(KP.dari); $('#rKe').value = placeLabel(KP.ke); draw(); };
    $$('[data-delapan]').forEach((b) => b.onclick = () => {
      KP.delapan = b.dataset.delapan === '1';
      $$('[data-delapan]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); });
      draw();
    });
    if ($('#lnQ')) {
      attachAC('lnQ', (it) => {
        if (it.kind === 'kota') { KP.lnKota = it.n; KP.lnNeg = negOfCity(it.n) || KP.lnNeg; }
        else { KP.lnNeg = it.n; KP.lnKota = cityOfNeg(it.n) || ''; }
        $('#lnNeg').value = KP.lnNeg;
        draw();
      }, lnSuggest);
      $('#lnAsal').onchange = (e) => { KP.lnAsal = e.target.value; draw(); };
      $('#lnNeg').onchange = (e) => { KP.lnNeg = e.target.value; draw(); };
      const kurs = $('#lnKurs');
      kurs.addEventListener('input', () => {
        const v = Number(kurs.value.replace(/[^\d,]/g, '').replace(',', '.'));
        KP.kurs = v > 0 ? v : 0; store.set('kurs', KP.kurs); draw();
      });
      kurs.addEventListener('blur', () => { kurs.value = KP.kurs ? KP.kurs.toLocaleString('id-ID', { maximumFractionDigits: 2 }) : ''; });
      $$('[data-kelasln]').forEach((sel) => sel.onchange = () => { KP.kelasLn[sel.dataset.kelasln] = sel.value; draw(); });
    }
    $$('[data-clear]').forEach((b) => b.onclick = () => { const i = $('#' + b.dataset.clear); i.value = ''; i.focus(); i.dispatchEvent(new Event('input')); });
    $$('[data-jenis]').forEach((b) => b.onclick = () => {
      KP.jenis = b.dataset.jenis;
      $$('[data-jenis]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); });
      draw();
    });
    const setStp = (id, v, keepText = false) => {
      const el = $(`[data-stp="${id}"]`);
      const min = Number(el.dataset.min), max = Number(el.dataset.max);
      v = Math.max(min, Math.min(max, Number.isFinite(v) ? v : min));
      const inp = el.querySelector('input');
      if (!keepText) inp.value = v;
      el.querySelector('[data-d="-1"]').disabled = v <= min;
      el.querySelector('[data-d="1"]').disabled = v >= max;
      return v;
    };
    const applyStp = (id, v, keepText) => {
      if (id === 'hari') {
        KP.hari = setStp('hari', v, keepText);
        const m = $('[data-stp="malam"]');
        const mv = KP.malamManual ? Math.min(KP.malam, KP.hari) : Math.min(KP.hari, autoMalam(KP.hari));
        if (m) { m.dataset.max = KP.hari; KP.malam = setStp('malam', mv); } else KP.malam = mv;
      } else if (id === 'malam') { KP.malamManual = true; KP.malam = setStp('malam', v, keepText); }
      else if (id.startsWith('org:')) { const k = id.slice(4); KP.org[k] = setStp(id, v, keepText); }
      draw();
    };
    $('.kp-form').addEventListener('input', (e) => {
      const inp = e.target.closest('.stp-in');
      if (!inp) return;
      inp.value = inp.value.replace(/\D/g, '');
      if (inp.value === '') return;
      applyStp(inp.closest('.stp').dataset.stp, Number(inp.value), true);
    });
    $('.kp-form').addEventListener('focusout', (e) => {
      const inp = e.target.closest('.stp-in');
      if (!inp) return;
      const id = inp.closest('.stp').dataset.stp;
      const cur = id === 'hari' ? KP.hari : id === 'malam' ? KP.malam : KP.org[id.slice(4)];
      applyStp(id, inp.value === '' ? cur : Number(inp.value));
    });
    $('.kp-form').addEventListener('focusin', (e) => { const inp = e.target.closest('.stp-in'); if (inp) inp.select(); });
    $('.kp-form').addEventListener('keydown', (e) => { const inp = e.target.closest('.stp-in'); if (inp && e.key === 'Enter') inp.blur(); });
    $('#kpReset').onclick = () => { resetKP(); route(); toast('Isian dikembalikan ke awal'); };
    $('.kp-form').addEventListener('click', (e) => {
      const b = e.target.closest('.stp button');
      if (!b) return;
      const id = b.closest('.stp').dataset.stp;
      const d = Number(b.dataset.d);
      const cur = id === 'hari' ? KP.hari : id === 'malam' ? KP.malam : KP.org[id.slice(4)];
      applyStp(id, cur + d);
    });
    $$('[data-kelas]').forEach((sel) => sel.onchange = () => { KP.kelas[sel.dataset.kelas] = sel.value; draw(); });
    draw();
    const firstEmpty = KP.lingkup === 'ln' ? (!KP.lnKota && !KP.lnNeg && $('#lnQ')) : (!KP.ke && $('#rKe'));
    if (firstEmpty) setTimeout(() => firstEmpty.focus(), 50);
  };
  return { html, after };
}

function viewAlat() {
  const card = (t) => {
    const subs = (t.sub || []).map((x) => `<a class="al-sub" href="${x.h}">${ic(x.i)}<span><b>${esc(x.t)}</b><small>${esc(x.d)}</small></span>${x.soon ? '<span class="chip sm soon">Segera</span>' : ''}</a>`).join('');
    return `<section class="card al-card${t.soon ? ' soon' : ''}">
      <a class="al-head" href="${t.h}"><span class="tool-ico">${ic(t.i)}</span><span class="al-tx"><b>${esc(t.t)}</b><small>${esc(t.d)}</small></span>${t.soon ? '<span class="chip">Segera hadir</span>' : ''}</a>
      ${subs ? `<div class="al-subs">${subs}</div>` : ''}
    </section>`;
  };
  return `<div class="page-head"><h1 class="title">Alat Bantu</h1><p class="subtitle">Alat hitung cepat untuk membantu tim keuangan menguji pengadaan dan pembayaran. Angka diambil dari SBM TA ${Y.y} yang sedang dipilih.</p></div>
  <div class="al-grid">${TOOLS.map(card).join('')}</div>`;
}
const SOON_PLAN = {
  pajak: ['PPN', 'PPh Pasal 21', 'PPh Pasal 22', 'PPh Pasal 23', 'PPh Pasal 4 ayat (2)'],
};
function viewSoonTool(t, parent) {
  const plan = SOON_PLAN[t.k];
  const others = parent.sub.filter((x) => x.k !== t.k);
  return `<div class="page-head"><h1 class="title">${esc(t.t)}</h1><p class="subtitle">${esc(t.d)}. Bagian dari ${esc(parent.t)}.</p></div>
  <div class="callout">${ic('clock')}<div><b>Segera hadir.</b> Alat ini sedang disiapkan bersama tim Perbendaharaan dan baru dibuka setelah cara hitungnya diperiksa. Sampai saat itu, halaman ini belum menghitung apa pun.</div></div>
  ${plan ? `<div class="card card-pad" style="margin-top:14px"><div class="group-title" style="margin:0 0 8px">Rencana isi</div><ul class="plan-list">${plan.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
  <div class="group-title">Alat lain di ${esc(parent.t)}</div>
  <div class="card list">${others.map((x) => `<a class="li" href="${x.h}"><span class="li-ico">${ic(x.i)}</span><div class="grow"><div class="t">${esc(x.t)}</div><div class="d">${esc(x.d)}</div></div>${x.soon ? '<span class="chip soon">Segera</span>' : ''}${ic('chev', 'chev')}</a>`).join('')}</div>`;
}
function viewSaved() {
  const sv = saved().map(entry).filter(Boolean);
  return `<div class="page-head"><h1 class="title">Favorit</h1><p class="subtitle">Jenis satuan biaya yang Anda jadikan favorit, terbaru di atas. Delapan favorit terakhir tampil di Beranda. Tersimpan di perangkat ini.</p></div>
  ${sv.length ? `<div class="card list">${sv.map(entryRow).join('')}</div>` : `<div class="empty">Belum ada favorit. Buka jenis satuan biaya lalu ketuk ${ic('star')} <b>Jadikan favorit</b>.</div>`}`;
}

/* ---------------- Lainnya ---------------- */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; });

// Paragraf toleransi dari data ("6. untuk satuan biaya … sebagai berikut:")
function tolPara(x) {
  const m = x.match(/^(\d+\.)\s*(.*)$/s);
  const body = (m ? m[2] : x).replace(/sebagai berikut:\s*$/, 'sebagai berikut (lihat tabel di bawah).');
  return `<p class="blk l1"><span class="m">${m ? m[1] : ''}</span>${esc(body)}</p>`;
}
function viewMore(sub) {
  const M = S.data.meta;
  const back = `<div class="crumb"><a href="#/lainnya">Lainnya</a></div>`;
  if (sub === 'tentang' && Y.y === 2026) {
    return { html: `<div class="page-head">${back}<h1 class="title">Tentang dasar hukum</h1><p class="subtitle">Tahun Anggaran 2026</p></div>
    <div class="grid">${disclaimerCard()}
      <div class="card card-pad"><table class="plain"><tbody>
        <tr><th colspan="2">${esc(M.pmk.nomor)}</th></tr>
        <tr><td>Tentang</td><td>${esc(M.pmk.tentang)}</td></tr>
        <tr><td>Ditetapkan</td><td>${esc(M.pmk.ditetapkan)}</td></tr>
        <tr><td>Diundangkan</td><td>${esc(M.pmk.diundangkan)}</td></tr>
        <tr><td>Digunakan</td><td>${esc(M.pmk.berlaku)} (Pasal 1)</td></tr>
        <tr><td>Isi</td><td>Satu dokumen memuat norma, besaran rupiah, dan Penjelasan: Lampiran I (batas tertinggi, 39 butir) dan Lampiran II (dapat dilampaui, 19 butir). ${M.pmk.halaman} halaman. Untuk TA 2026 tidak ada KMK rincian besaran terpisah seperti TA 2027.</td></tr>
      </tbody></table><div class="actions"><a class="btn" href="${Y.doc}" target="_blank" rel="noopener">${ic('download')} PDF PMK 32/2025</a></div></div>
      <div class="card card-pad"><table class="plain"><tbody><tr><th colspan="2">Penomoran butir</th></tr><tr><td colspan="2">Urutan butir PMK 32/2025 berbeda dengan TA 2027 (misalnya penginapan: angka 30 di TA 2026, angka 27 di TA 2027). Aplikasi memakai menu yang sama untuk kedua tahun; nomor yang tampil di tabel, rujukan, dan tombol PDF adalah nomor asli PMK 32/2025.</td></tr></tbody></table></div>
      <div class="card card-pad"><table class="plain"><tbody><tr><th colspan="2">Data wilayah (fitur Rute)</th></tr><tr><td>Sumber</td><td>idn-area-data v4.0.1 oleh Fityan Nugroho, dari data wilayah administrasi Kemendagri. Dilisensikan dengan Open Database License (ODbL).</td></tr><tr><td>Isi</td><td>38 provinsi dan 514 kabupaten/kota, dipetakan ke baris PMK (transport darat, Bodetabek) dan kota tiket.</td></tr></tbody></table></div>
      <div class="card card-pad"><table class="plain"><tbody><tr><th colspan="2">Pembuat PDF</th></tr><tr><td>Sumber</td><td>jsPDF v2.5.2 dan jspdf-autotable v3.8.4, dilisensikan dengan MIT License. Disematkan di aplikasi untuk fitur Unduh PDF di Kalkulator Perjadin.</td></tr></tbody></table></div>
      <div class="card card-pad"><table class="plain"><tbody><tr><th colspan="2">Ikon</th></tr><tr><td>Sumber</td><td>Lucide (lucide.dev), lucide-static v1.75.0. Dilisensikan dengan ISC License, © Lucide Contributors. Disematkan di aplikasi agar berfungsi tanpa internet.</td></tr></tbody></table></div>
      <div class="callout">${ic('info')}<div>Seluruh angka diambil langsung dari tabel PDF PMK 32/2025 dan dicek silang dengan ekstraksi teks kedua (${Y.rows} baris data; semua nominal rupiah di tabel cocok dengan teks). Aplikasi ini alat bantu baca; untuk keperluan formal, rujuk dokumen aslinya.</div></div>
    </div>` };
  }
  if (sub === 'tentang') {
    return { html: `<div class="page-head">${back}<h1 class="title">Tentang dasar hukum</h1></div>
    <div class="grid">${disclaimerCard()}
      <div class="card card-pad"><table class="plain"><tbody>
        <tr><th colspan="2">${esc(M.pmk.nomor)}</th></tr>
        <tr><td>Tentang</td><td>${esc(M.pmk.tentang)}</td></tr>
        <tr><td>Ditetapkan</td><td>${esc(M.pmk.ditetapkan)}</td></tr>
        <tr><td>Diundangkan</td><td>${esc(M.pmk.diundangkan)}</td></tr>
        <tr><td>Digunakan</td><td>${esc(M.pmk.berlaku)}</td></tr>
        <tr><td>Isi</td><td>Norma dan jenis satuan biaya (58 butir: Lampiran I batas tertinggi 39 butir, Lampiran II dapat dilampaui 19 butir). Tidak memuat besaran nominal. Besaran ditetapkan Menteri Keuangan (Pasal 3 ayat (3)).</td></tr>
      </tbody></table><div class="actions"><a class="btn" href="docs/pmk-54-2026.pdf" target="_blank" rel="noopener">${ic('download')} PDF PMK 54/2026</a></div></div>
      <div class="card card-pad"><table class="plain"><tbody>
        <tr><th colspan="2">${esc(M.kmk.nomor)}</th></tr>
        <tr><td>Tentang</td><td>${esc(M.kmk.tentang)}</td></tr>
        <tr><td>Ditetapkan</td><td>${esc(M.kmk.ditetapkan)}</td></tr>
        <tr><td>Berlaku</td><td>${esc(M.kmk.berlaku)} (Diktum KEEMPAT); digunakan dalam penyusunan RKA-K/L TA 2027 (Diktum KETIGA)</td></tr>
        <tr><td>Isi</td><td>Lampiran I (batas tertinggi) beserta Penjelasan, Lampiran II (dapat dilampaui) beserta Penjelasan. ${M.kmk.halaman} halaman.</td></tr>
      </tbody></table><div class="actions"><a class="btn" href="docs/kmk-296-2026.pdf" target="_blank" rel="noopener">${ic('download')} PDF KMK 296/2026</a></div></div>
      <div class="card card-pad"><table class="plain"><tbody><tr><th colspan="2">Data wilayah (fitur Rute)</th></tr><tr><td>Sumber</td><td>idn-area-data v4.0.1 oleh Fityan Nugroho, dari data wilayah administrasi Kemendagri. Dilisensikan dengan Open Database License (ODbL).</td></tr><tr><td>Isi</td><td>38 provinsi dan 514 kabupaten/kota, dipetakan ke baris KMK (transport darat, Bodetabek) dan kota tiket. Pemetaan nama yang berbeda dicatat di Catatan atas dokumen.</td></tr></tbody></table></div>
      <div class="card card-pad"><table class="plain"><tbody><tr><th colspan="2">Pembuat PDF</th></tr><tr><td>Sumber</td><td>jsPDF v2.5.2 dan jspdf-autotable v3.8.4, dilisensikan dengan MIT License. Disematkan di aplikasi untuk fitur Unduh PDF di Kalkulator Perjadin.</td></tr></tbody></table></div>
      <div class="card card-pad"><table class="plain"><tbody><tr><th colspan="2">Ikon</th></tr><tr><td>Sumber</td><td>Lucide (lucide.dev), lucide-static v1.75.0. Dilisensikan dengan ISC License, © Lucide Contributors. Disematkan di aplikasi agar berfungsi tanpa internet.</td></tr></tbody></table></div>
      <div class="callout">${ic('info')}<div>Seluruh angka diambil langsung dari tabel PDF KMK 296/2026 dan dicek silang dengan ekstraksi teks kedua (3.168 baris bernomor cocok). Aplikasi ini alat bantu baca; untuk keperluan formal, rujuk dokumen aslinya.</div></div>
    </div>` };
  }
  if (sub === 'catatan') {
    const CU = S.data.catatan_umum;
    const tol = S.data.toleransi;
    return { html: `<div class="page-head">${back}<h1 class="title">Catatan Umum ${Y.srcKind}</h1><p class="subtitle">Catatan di akhir Lampiran I dan Lampiran II ${Y.src}.</p></div>
    <div class="grid">
      <div class="card card-pad reg"><h3>Catatan Umum Lampiran I</h3>${renderReg(CU.L1)}${CU.tol_L1 ? tolPara(CU.tol_L1) : `<p class="blk l1"><span class="m">5.</span>untuk satuan biaya pengadaan kendaraan operasional bus, sewa kendaraan, pengadaan kendaraan operasional kantor dan/atau lapangan roda 2 dan roda 4, pengadaan pakaian dinas, dan konsumsi rapat pada beberapa kabupaten diberikan toleransi pengusulan satuan biaya melebihi ketentuan (lihat tabel di bawah).</p>`}</div>
      <div class="card card-pad reg"><h3>Catatan Umum Lampiran II</h3>${renderReg(CU.L2)}${CU.tol_L2 ? tolPara(CU.tol_L2) : `<p class="blk l1"><span class="m">3.</span>Untuk satuan biaya pemeliharaan dan operasional kendaraan dinas, pemeliharaan sarana kantor, penggantian inventaris lama dan/atau pembelian inventaris untuk pegawai baru, pengadaan bahan makanan, sewa mesin fotokopi, dan pemeliharaan gedung/bangunan dalam negeri, pada beberapa kabupaten diberikan toleransi pengusulan satuan biaya melebihi ketentuan (lihat tabel di bawah).</p>`}</div>
      <div class="card card-pad"><div class="reg"><h3>Toleransi kabupaten tertentu</h3></div>
        <div class="callout warn" style="margin-bottom:12px">${ic('alert')}<div>Toleransi ini <b>tidak berlaku untuk satuan biaya perjalanan dinas</b> (uang harian, penginapan, paket rapat, transportasi, tiket). Hanya untuk satuan biaya yang disebut pada butir ${Y.tolL1} (Lampiran I) dan butir 3 (Lampiran II) di atas.</div></div>
        <table class="plain"><thead><tr><th>Provinsi</th><th>Kabupaten</th><th style="text-align:right">Toleransi</th></tr></thead><tbody>${tol.map((t) => `<tr><td>${esc(t[0])}</td><td>${esc(t[1])}</td><td style="text-align:right" class="tnum"><b>${t[2]}%</b></td></tr>`).join('')}</tbody></table>
        <div class="src">Persentase dari satuan biaya provinsi yang bersangkutan.</div></div>
    </div>` };
  }
  if (sub === 'singkatan') {
    return { html: `<div class="page-head">${back}<h1 class="title">Daftar singkatan satuan</h1></div><div class="card card-pad"><table class="plain"><tbody>${S.data.singkatan.map((s) => `<tr><td><b>${esc(s[0])}</b></td><td>${esc(s[1])}</td></tr>`).join('')}</tbody></table><div class="src">Pengertian Istilah, ${Y.src}.</div></div>` };
  }
  if (sub === 'dokumen') {
    return { html: `<div class="page-head">${back}<h1 class="title">Catatan atas dokumen</h1><p class="subtitle">Hal-hal di dokumen ${Y.src} (TA ${Y.y}) yang perlu diketahui saat membaca aplikasi ini.</p></div><div class="card list">${DOC_NOTES.map((d) => `<div class="li"><div class="grow"><div class="t">${esc(d.t)}</div><div class="d">${esc(d.x)}</div></div></div>`).join('')}</div>` };
  }
  const pref = store.get('theme', 'system');
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const html = `
  <div class="page-head"><h1 class="title">Lainnya</h1></div>
  <div class="group-title">Tahun anggaran</div>
  <div class="card card-pad">${yearSwitch('more')}<div class="muted small" style="margin-top:10px">TA 2027: PMK 54/2026 dan KMK 296/2026. TA 2026: PMK 32/2025. Pilihan disimpan di perangkat ini.</div></div>
  <div class="group-title">Tampilan</div>
  <div class="card card-pad"><div class="theme-pick">
    <button data-th="light" class="${pref === 'light' ? 'on' : ''}">${ic('sun')} Terang</button>
    <button data-th="dark" class="${pref === 'dark' ? 'on' : ''}">${ic('moon')} Gelap</button>
    <button data-th="system" class="${pref === 'system' ? 'on' : ''}">${ic('monitor')} Otomatis</button>
  </div></div>
  <div class="group-title">Menu</div>
  <div class="card list">
    <a class="li" href="#/tersimpan">${ic('star', 'chev')}<div class="grow"><div class="t">Favorit</div></div>${ic('chev', 'chev')}</a>
    <a class="li" href="#/lainnya/catatan">${ic('list', 'chev')}<div class="grow"><div class="t">Catatan Umum ${Y.srcKind}</div></div>${ic('chev', 'chev')}</a>
    <a class="li" href="#/lainnya/singkatan">${ic('book', 'chev')}<div class="grow"><div class="t">Daftar singkatan</div></div>${ic('chev', 'chev')}</a>
    <a class="li" href="#/lainnya/dokumen">${ic('alert', 'chev')}<div class="grow"><div class="t">Catatan atas dokumen</div></div>${ic('chev', 'chev')}</a>
    <a class="li" href="#/lainnya/tentang">${ic('info', 'chev')}<div class="grow"><div class="t">Tentang ${Y.y === 2026 ? 'PMK 32/2025' : 'PMK 54/2026 & KMK 296/2026'}</div></div>${ic('chev', 'chev')}</a>
  </div>
  <div class="group-title">Aplikasi</div>
  <div class="card card-pad">
    ${isStandalone ? '<div class="muted">Aplikasi sudah terpasang di perangkat ini.</div>' : `<div class="row" style="justify-content:space-between"><div class="row"><b>Pasang di perangkat</b>${tip('Buka lebih cepat dan tetap bisa dipakai tanpa internet.')}</div><button class="btn primary" id="installBtn">${ic('phone')} Pasang</button></div><div class="muted small" id="installHelp" style="margin-top:10px;display:none">Di Chrome HP: ketuk menu ⋮ lalu pilih <b>Tambahkan ke layar utama</b> / <b>Instal aplikasi</b>. Di PC: klik ikon pasang di kolom alamat.</div>`}
  </div>
  <div class="group-title">Cakupan</div>
  <div class="card list">${BABS.map((b) => `<a class="li${b.active ? '' : ' soon'}" href="#/bab/${b.key}"><span class="li-ico">${ic(b.icon)}</span><div class="grow"><div class="t">${esc(b.name)}</div><div class="d">${b.count} ${b.active ? 'jenis satuan biaya' : 'butir'}</div></div>${b.active ? '<span class="chip ok">Tersedia</span>' : '<span class="chip soon">Segera</span>'}</a>`).join('')}</div>`;
  const after = () => {
    $$('[data-th]').forEach((b) => b.onclick = () => { store.set('theme', b.dataset.th); applyTheme(); $$('[data-th]').forEach((x) => x.classList.toggle('on', x === b)); });
    const ib = $('#installBtn');
    if (ib) ib.onclick = async () => {
      if (deferredPrompt) { deferredPrompt.prompt(); await deferredPrompt.userChoice.catch(() => {}); deferredPrompt = null; }
      else $('#installHelp').style.display = 'block';
    };
  };
  return { html, after };
}

/* ---------------- Keterangan (i) ---------------- */
function placeTip(t) {
  // Keterangan (i) memakai posisi fixed agar tidak terpotong kartu/hero/lipatan dan tidak tertimpa elemen lain
  const body = t.querySelector('.tip-body');
  const btn = t.querySelector('.tip-btn') || t;
  if (!body) return;
  const pad = 10;
  const vw = document.documentElement.clientWidth;
  // menu bawah HP menutupi bagian bawah layar; anggap batas bawah di atasnya
  const nav = document.querySelector('.bottomnav');
  const navTop = nav && getComputedStyle(nav).display !== 'none' ? nav.getBoundingClientRect().top : window.innerHeight;
  const vh = Math.min(window.innerHeight, navTop);
  const r = btn.getBoundingClientRect();
  body.style.left = '0px'; body.style.top = '0px';
  const w = body.offsetWidth, h = body.offsetHeight;
  let left = Math.min(Math.max(pad, r.left - 8), vw - w - pad);
  let top = r.bottom + 8;
  if (top + h > vh - pad && r.top - h - 8 > pad) top = r.top - h - 8;
  body.style.left = `${Math.round(left)}px`;
  body.style.top = `${Math.round(top)}px`;
}
function initTips() {
  const closeAll = (except) => $$('.tip.open').forEach((t) => t !== except && t.classList.remove('open'));
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.tip-btn');
    if (btn) {
      e.preventDefault(); e.stopPropagation();
      const t = btn.closest('.tip');
      const on = !t.classList.contains('open');
      closeAll(t);
      t.classList.toggle('open', on);
      if (on) placeTip(t);
      return;
    }
    if (!e.target.closest('.tip-body')) closeAll();
  }, true);
  if (window.matchMedia('(hover: hover)').matches) {
    document.addEventListener('mouseover', (e) => {
      const t = e.target.closest('.tip');
      if (t && !t.classList.contains('hover')) { t.classList.add('hover'); placeTip(t); }
    });
    document.addEventListener('mouseout', (e) => {
      const t = e.target.closest('.tip');
      if (t && !t.contains(e.relatedTarget)) t.classList.remove('hover');
    });
  }
  window.addEventListener('hashchange', () => closeAll());
  // posisi fixed tidak ikut tergulir: tutup saat halaman/area digulir, atur ulang saat ukuran berubah
  window.addEventListener('scroll', () => { closeAll(); $$('.tip.hover').forEach((t) => t.classList.remove('hover')); }, { capture: true, passive: true });
  window.addEventListener('resize', () => $$('.tip.open, .tip.hover').forEach(placeTip));
}

/* ---------------- Mulai ---------------- */
async function start() {
  applyYear(initYear());
  document.title = `SBM ${Y.y} · Standar Biaya Masukan TA ${Y.y}`;
  shell();
  initTips();
  $('#main').innerHTML = `<div class="empty">Memuat data…</div>`;
  try {
    await loadData();
    await loadWilayah();
  } catch (e) {
    $('#main').innerHTML = `<div class="empty">Gagal memuat data. Periksa koneksi lalu muat ulang.</div>`;
    return;
  }
  buildIndex();
  window.addEventListener('hashchange', route);
  route();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
start();
