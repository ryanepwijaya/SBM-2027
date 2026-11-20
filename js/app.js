import { ENTRIES, GROUPS, SHORTCUTS, SIFAT, KEL_ORDER, DOC_NOTES, TOL, applyYear } from './catalog.js';
import { S, Y, YEARS, switchYear, initYear, loadData, entry, entriesOf, esc, norm, ref, lampShort, fmt, valueCols, unitCol, shortCol, UNIT, rowsOfProv, rapatTiers, pdfLink, store, tip, fold, money, effPct, setEffPct, clearEff, effAll, pctTxt } from './store.js';
import { search, buildIndex, SEARCH_HINTS } from './search.js';
import { ic } from './icons.js';
import { loadWilayah, suggest, resolve, routeHtml, placeLabel, routeHints, W } from './rute.js';
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
  { k: 'tersimpan', h: '#/tersimpan', t: 'Tersimpan', i: 'star' },
];
// Alat Bantu: alat hitung cepat untuk menguji pengadaan/pembayaran
const TOOLS = [
  {
    k: 'rute', h: '#/rute', t: 'Rute Perjadin', i: 'route', d: 'Satuan biaya perjalanan dinas dari kota asal ke kota tujuan, per provinsi, dan perbandingannya',
    sub: [
      { k: 'rute', h: '#/rute', t: 'Buat Perjalanan', i: 'signpost', d: 'Dari kota X ke kota Y, semua satuan biaya perjalanan dinas langsung muncul' },
      { k: 'daerah', h: '#/daerah', t: 'Cek Per Provinsi', i: 'map', d: 'Semua satuan biaya per provinsi, semua bab' },
      { k: 'bandingkan', h: '#/bandingkan', t: 'Bandingkan Wilayah', i: 'scale', d: 'Sampai 3 provinsi berdampingan' },
      { k: 'ln', h: '#/daerah/ln', t: 'Luar Negeri', i: 'globe', d: 'Uang harian per negara dan tiket per kota', hideSide: true },
    ],
  },
  { k: 'pajak', h: '#/alat/pajak', t: 'Perpajakan', i: 'percent', d: 'PPN dan PPh atas pembayaran oleh bendahara', soon: true },
];
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
  return `<div class="eff-note eff-sum" role="status">${ic('alert')}<div><b>Simulasi efisiensi aktif.</b> Angka berikut ditampilkan sebagian; besaran resmi tampil dicoret. <span class="chips">${items.join('')}</span></div><button type="button" class="btn sm" data-eff-clear>Kembali ke 100% semua</button></div>`;
}
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
  const brand = `<a class="brand" href="#/"><span class="brand-mark"><span>SBM</span></span><span class="brand-text"><b>SBM ${Y.y}</b><small>${Y.sources}</small></span></a>`;
  $('#app').innerHTML = `
  <aside class="sidebar" aria-label="Navigasi">
    ${brand}
    <div class="side-year">${yearSwitch('side')}</div>
    <div class="side-scroll" id="sideScroll">${sideHtml()}</div>
    <div class="side-foot">
      <button class="side-btn" id="sideTheme" data-theme-ico aria-label="Ganti tema" data-tip="Ganti tema"></button>
      <span class="side-ver">SBM TA ${Y.y}</span>
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
    if (t.sub) {
      const body = stagger([`<div class="fly-h">${ic(t.i)}${esc(t.t)}</div>`, ...t.sub.filter((x) => !x.hideSide).map((x) => `<a class="acc-it" href="${x.h}" data-item="tool:${x.k}">${ic(x.i)}<span>${esc(x.t)}</span></a>`)]);
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
    const tool = TOOLS.find((t) => t.k === key && t.sub);
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
      item({ href: '#/daerah', t: 'Cek Per Provinsi', d: 'Semua satuan biaya per provinsi, semua bab', i: 'map' }),
      item({ href: '#/bandingkan', t: 'Bandingkan Wilayah', d: 'Sampai 3 provinsi berdampingan', i: 'scale' }),
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
        if (parts[1] === 'pajak') { side = ['pajak']; cr.push({ t: 'Perpajakan' }); html = viewPajak(); }
        else { cr[cr.length - 1] = { t: 'Alat Bantu', i: 'calculator' }; html = viewAlat(); }
        break;
      case 'daerah':
        setNav('alat');
        side = [null, parts[1] === 'ln' ? null : 'tool:daerah', 'rute'];
        cr.push(ALAT_CRUMB, RUTE_CRUMB);
        if (parts[1] === 'p') { cr.push({ t: 'Cek Per Provinsi', h: '#/daerah' }, { t: S.prov[parts[2]]?.nama || 'Provinsi' }); ({ html, after } = viewProv(parts[2])); }
        else { cr.push({ t: parts[1] === 'ln' ? 'Luar Negeri' : 'Cek Per Provinsi' }); ({ html, after } = viewDaerah(parts[1] === 'ln' ? 'ln' : 'dn', params)); }
        break;
      case 'rute': setNav('alat'); side = [null, 'tool:rute', 'rute']; cr.push(ALAT_CRUMB, RUTE_CRUMB, { t: 'Buat Perjalanan' }); ({ html, after } = viewRute(params)); break;
      case 'bandingkan': setNav('alat'); side = [null, 'tool:bandingkan', 'rute']; cr.push(ALAT_CRUMB, RUTE_CRUMB, { t: 'Bandingkan Wilayah' }); ({ html, after } = viewCompare(params)); break;
      case 'tersimpan': setNav('tersimpan'); side = ['tersimpan']; cr.push({ t: 'Tersimpan', i: 'star' }); html = viewSaved(); break;
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

function footer() {
  const about = Y.y === 2026
    ? 'PMK Nomor 32 Tahun 2025 tentang Standar Biaya Masukan Tahun Anggaran 2026.'
    : 'PMK Nomor 54 Tahun 2026 tentang Standar Biaya Masukan dan KMK Nomor 296 Tahun 2026 tentang Rincian Besaran Standar Biaya Masukan (TA 2027).';
  return `<div class="foot">Sumber: ${Y.sources} ${tip(about + ' Aplikasi bantu baca, bukan dokumen resmi. Untuk keperluan formal, rujuk dokumen aslinya.')}</div>`;
}

/* ---------------- Beranda ---------------- */
const HOME_HINTS = ['uang harian jatim', 'jakarta surabaya', 'penginapan dki', 'taksi bali', 'fullboard', 'jepang'];
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
function viewHome() {
  const recent = store.get('recent', []).map(entry).filter(Boolean).slice(0, 5);
  const sv = saved().map(entry).filter(Boolean).slice(0, 5);
  const total = S.data.butir.length;
  const mini = (arr, empty) => arr.length ? `<div class="card list">${arr.map(entryRow).join('')}</div>` : `<div class="card empty-card">${empty}</div>`;
  const tool = (h, i, t, d) => `<a class="tool" href="${h}"><span class="tool-ico">${ic(i)}</span><span class="tool-tx"><b>${t}</b><small>${d}</small></span>${ic('chevron-right', 'chev')}</a>`;
  return `
  <section class="hero hero-u">
    <h1>Standar Biaya Masukan TA ${Y.y} ${tip(`Baca ${Y.y === 2026 ? 'PMK 32/2025' : 'PMK 54/2026 dan KMK 296/2026'} tanpa membuka PDF. Semua angka diambil dari tabel ${Y.srcKind} dan dicek silang.`)}</h1>
    <label class="hero-search" for="hq">${ic('search')}<input id="hq" type="search" placeholder="Cari satuan biaya, provinsi, kota, atau aturan…" autocomplete="off" enterkeyhint="search"><kbd class="hide-sm">${isMac ? '⌘' : 'Ctrl'} K</kbd></label>
    <div class="hero-tags">${HOME_HINTS.map((h) => `<a href="#/cari?q=${encodeURIComponent(h)}" data-q="${esc(h)}">${esc(h)}</a>`).join('')}</div>
    <div class="hero-law">
      ${Y.y === 2026 ? `<a href="#/lainnya/tentang"><b>PMK 32/2025</b><span>Norma, besaran & penjelasan</span></a>` : `<a href="#/lainnya/tentang"><b>PMK 54/2026</b><span>Norma & jenis</span></a>
      <a href="#/lainnya/tentang"><b>KMK 296/2026</b><span>Besaran rupiah</span></a>`}
      <span><b>${total} butir</b><span>dalam ${BABS.length} bab</span></span>
    </div>
  </section>
  <h2 class="sec">${ic('layers-2')} Bab satuan biaya <small>${S.data.butir.length} butir ${Y.srcKind}</small></h2>
  <div class="bab-grid">${babFeature(BABS[0], 0)}<div class="bab-rest">${BABS.slice(1).map((b, i) => babCard(b, i + 1)).join('')}</div></div>
  <h2 class="sec">${ic('calculator')} Alat bantu <a class="sec-more" href="#/alat">Semua alat bantu</a></h2>
  <div class="tools">
    <section class="card card-pad tool-route">
      <div class="row tr-head"><span class="tool-ico">${ic('route')}</span><div><b>Buat perjalanan</b><small>Dari kota X ke kota Y, semua satuan biaya langsung muncul</small></div>${tip('Mencakup 514 kabupaten/kota dan 38 provinsi. Kota asal bawaan: Jakarta.')}</div>
      ${routeForm('jakarta', '', true)}
    </section>
    <div class="tool-list card">
      ${tool('#/daerah', 'map', 'Cek per provinsi', 'Semua satuan biaya per provinsi, semua bab')}
      ${tool('#/bandingkan', 'scale', 'Bandingkan wilayah', 'Sampai 3 provinsi berdampingan')}
      ${tool('#/daerah/ln', 'globe', 'Luar negeri', 'Uang harian per negara & tiket per kota')}
      ${tool('#/alat/pajak', 'percent', 'Perpajakan <span class="chip sm">Segera</span>', 'PPN dan PPh atas pembayaran oleh bendahara')}
    </div>
  </div>
  <div class="two-col">
    <div><h2 class="sec">${ic('history')} Terakhir dilihat</h2>${mini(recent, 'Halaman yang Anda buka akan muncul di sini.')}</div>
    <div><h2 class="sec">${ic('star')} Tersimpan</h2>${mini(sv, `Tekan ${ic('star')} <b>Simpan</b> di halaman satuan biaya untuk menyimpannya di sini.`)}</div>
  </div>
`;
}
function afterHome() {
  let dari = 'jakarta';
  attachAC('rDari', (it) => { dari = it.id; });
  attachAC('rKe', (it) => { location.hash = `#/rute?dari=${encodeURIComponent(dari)}&ke=${encodeURIComponent(it.id)}`; });
  $('#rSwap').style.visibility = 'hidden';
  $$('[data-clear]').forEach((b) => b.onclick = () => { const i = $('#' + b.dataset.clear); i.value = ''; i.focus(); });
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
      <a href="#/daerah">${ic('map')}<span><b>Cek per provinsi</b><small>Semua biaya satu provinsi</small></span></a>
      <a href="#/bandingkan">${ic('scale')}<span><b>Bandingkan wilayah</b><small>Sampai 3 provinsi</small></span></a>
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

function renderTable(t, opt = {}) {
  const vc = new Set(valueCols(t));
  const uc = unitCol(t);
  const hideCols = new Set();
  if (uc && uc.unit) hideCols.add(uc.i);
  const cols = t.cols.map((c, i) => ({ c, i })).filter((x) => !hideCols.has(x.i));
  let rows = opt.rows || t.rows;
  const f = norm(opt.filter || '');
  if (f) {
    const toks = f.split(' ');
    const keep = [];
    let pendingGroup = null;
    for (const r of rows) {
      if (r.g) { pendingGroup = r; continue; }
      const hay = norm(r.v.join(' ') + ' ' + (pendingGroup ? pendingGroup.g : ''));
      if (toks.every((tk) => hay.split(' ').some((w) => w.startsWith(tk)))) {
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
  return `<div class="tbl-meta">${meta.join('<span>·</span>')}</div>
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
  const effCtl = `<div class="eff-ctl"><label for="effIn">Dibayar</label><span class="eff-box"><input id="effIn" type="text" inputmode="decimal" autocomplete="off" maxlength="6" value="100" aria-describedby="effHelp"><span>%</span></span>${tip('Untuk simulasi efisiensi, misalnya kebijakan pemotongan perjalanan dinas. Isi persentase yang dibayar (1–100); semua angka di tabel ini dihitung ulang dan besaran SBM aslinya tetap tampil dicoret di bawahnya. Tersimpan di perangkat ini per tabel dan per tahun anggaran, dan ikut dipakai di halaman Rute, Daerah, dan Bandingkan. Besaran resmi SBM tidak berubah.')}</div>`;
  if (id === 'L2-2') {
    tools = `<div class="tbl-tools"><select class="sel" id="provSel"><option value="">Semua provinsi (31)</option>${[...new Set(b.tables[0].rows.filter((r) => r.p).map((r) => r.p))].map((p) => `<option value="${p}"${p === state.prov ? ' selected' : ''}>${esc(S.prov[p].nama)}</option>`).join('')}</select><label class="field">${ic('search')}<input id="tblq" type="search" placeholder="Cari kabupaten/kota…" value="${esc(state.filter)}"></label>${effCtl}</div>`;
  } else if (id === 'L2-6') {
    tools = `<div class="tbl-tools"><label class="field">${ic('search')}<input id="tblq" type="search" placeholder="Cari kota, mis. surabaya atau jakarta makassar…" value="${esc(state.filter)}"></label>${effCtl}</div>`;
  } else if (big && !(id === 'L1-29')) {
    tools = `<div class="tbl-tools"><label class="field">${ic('search')}<input id="tblq" type="search" placeholder="Saring baris tabel…" value="${esc(state.filter)}"></label>${effCtl}</div>`;
  } else if (id === 'L1-29') {
    tools = `<div class="tbl-tools" id="rapatTools"><label class="field">${ic('search')}<input id="tblq" type="search" placeholder="Saring provinsi…" value="${esc(state.filter)}"></label>${effCtl}</div>`;
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
    host.innerHTML = effNote + renderTable(t, { rows, filter, sort: state.sort, hl: params.r });
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
      <button class="btn sm${isSaved(e.key) ? ' on' : ''}" id="saveBtn">${ic('star')} <span>${isSaved(e.key) ? 'Tersimpan' : 'Simpan'}</span></button>
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
      $('#saveBtn span').textContent = on ? 'Tersimpan' : 'Simpan';
      toast(on ? 'Disimpan' : 'Dihapus dari tersimpan');
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
  return `<div class="seg"><a href="#/rute" class="${mode === 'rute' ? 'on' : ''}">Buat Perjalanan</a><a href="#/daerah" class="${mode === 'dn' ? 'on' : ''}">Cek Per Provinsi</a><a href="#/daerah/ln" class="${mode === 'ln' ? 'on' : ''}">Luar Negeri</a></div>`;
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
function attachAC(inputId, onPick) {
  const inp = $('#' + inputId);
  const box = $('#' + inputId + '-ac');
  let items = [], idx = -1;
  const render = () => {
    if (!items.length) { box.innerHTML = inp.value.trim() ? '<div class="ac-empty">Tidak ditemukan</div>' : ''; box.classList.toggle('open', !!inp.value.trim()); return; }
    box.innerHTML = items.map((it, i) => `<button type="button" class="ac-it${i === idx ? ' on' : ''}" data-i="${i}"><span class="ac-t">${esc(it.n)}${it.air ? ' <span class="ac-air" title="Ada di tabel tiket pesawat ${Y.srcKind}">' + ic('plane') + '</span>' : ''}</span><span class="ac-s">${esc(it.sub)}</span><span class="ac-b">${esc(it.t)}</span></button>`).join('');
    box.classList.add('open');
  };
  inp.addEventListener('input', () => { items = suggest(inp.value); idx = items.length ? 0 : -1; render(); });
  inp.addEventListener('focus', () => { inp.select(); if (inp.value.trim()) { items = suggest(inp.value); idx = 0; render(); } });
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
  ${daerahSeg('rute')}
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
    <div class="page-head"><h1 class="title">Cek Per Provinsi</h1><p class="subtitle">Pilih provinsi untuk melihat semua satuan biaya yang ditetapkan per provinsi (perjalanan dinas dan bab lain) dalam satu halaman.</p></div>
    ${seg}
    <div class="tbl-tools"><label class="field">${ic('search')}<input id="pq" type="search" placeholder="Cari provinsi atau kota, mis. jatim, surabaya…"></label><a class="btn" href="#/bandingkan">${ic('compare')} Bandingkan provinsi</a></div>
    <div class="prov-grid" id="provGrid">${S.provList.map((p) => `<a class="prov" href="#/daerah/p/${p.id}" data-s="${esc(norm([p.nama, ...p.alias, ...p.kota].join(' ')))}"><b>${esc(p.nama)}</b><small>${esc(p.kota[0])}</small></a>`).join('')}</div>`;
    const after = () => {
      const pq = $('#pq');
      pq.oninput = () => {
        const toks = norm(pq.value).split(' ').filter(Boolean);
        $$('#provGrid .prov').forEach((a) => { a.style.display = toks.every((t) => a.dataset.s.split(' ').some((w) => w.startsWith(t))) ? '' : 'none'; });
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

function viewProv(pid) {
  const p = S.prov[pid];
  if (!p) return { html: `<div class="empty">Provinsi tidak ditemukan.</div>` };
  const B = S.butir;
  const link = (bid, t, code) => `#/b/${bid}?t=${t}${code ? '&r=' + encodeURIComponent(code) : ''}`;
  const card = (title, b, inner, more, note) => `<section class="card card-pad dcard"><div class="head"><h3>${esc(title)} ${note ? tip(note) : ''}</h3><a class="more" href="${more}">${lampShort(b)} ›</a></div>${inner}</section>`;
  const kv = (t, r, idxs) => `<div class="kv">${idxs.map((i) => `<div><div class="k">${esc(shortCol(t.cols[i]))}</div><div class="v">${money(t, r.n[i], r.cu || t.cur)}</div></div>`).join('')}</div>`;

  // Uang harian
  const tUH = B['L1-25'].tables[0];
  const rUH = tUH.rows.find((r) => r.p === pid);
  const cUH = card('Uang Harian', B['L1-25'], rUH ? kv(tUH, rUH, valueCols(tUH)) : '<p class="na">Tidak tercantum</p>', link('L1-25', 0, rUH?.c),
    'Per orang per hari. Jika transpor lokal dibayar riil (lebih dari satu lokasi tujuan dalam kab/kota yang sama), uang harian 60%.');
  // Penginapan
  const tH = B['L1-27'].tables[0];
  const rH = tH.rows.find((r) => r.p === pid);
  const cH = card('Penginapan (Hotel)', B['L1-27'], rH ? kv(tH, rH, valueCols(tH)) : '<p class="na">Tidak tercantum</p>', link('L1-27', 0, rH?.c), 'Per orang per hari, dengan bukti pengeluaran yang sah.');
  // Taksi
  const tT = B['L2-5'].tables[0];
  const rT = tT.rows.find((r) => r.p === pid);
  const cT = card('Taksi ke/dari Bandara, Stasiun, Terminal', B['L2-5'], rT ? `<div class="kv"><div><div class="k">Sekali jalan (lumpsum)</div><div class="v">${money(tT, rT.n[3])}</div></div></div>` : `<div class="callout warn">${ic('alert')}<div>Provinsi ini tidak tercantum dalam tabel Lampiran II angka 5 KMK 296/2026.</div></div>`, link('L2-5', 0, rT?.c),
    'Bila melebihi, dapat dibayar riil sepanjang dari/ke kantor dan bukan kendaraan pribadi.');
  // Paket rapat
  const tiers = rapatTiers();
  const tR = B['L1-29'].tables[0];
  const rapRows = tiers.map((tr) => ({ name: tr.name, r: tr.rows.find((x) => x.p === pid) }));
  const vcR = valueCols(tR);
  const cR = card('Paket Rapat di Luar Kantor', B['L1-29'], `<div style="overflow:auto"><table class="mini"><thead><tr><th>Tingkat peserta</th>${vcR.map((i) => `<th class="n">${esc(tR.cols[i])}</th>`).join('')}</tr></thead><tbody>${rapRows.map((x) => `<tr><td>${esc(x.name)}</td>${vcR.map((i) => `<td class="n">${x.r ? money(tR, x.r.n[i]) : '–'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`,
    link('L1-29', 0, rapRows[2].r?.c), 'Per orang per paket. Uang harian rapat Rp130.000/OH hanya untuk fullboard (berlaku nasional). Eselon II ke atas: fullboard dapat 1,5×.');
  // Transport darat
  const tD = B['L2-2'].tables[0];
  const rD = tD.rows.filter((r) => r.v && r.p === pid);
  const cD = card('Transport Darat dari Ibu Kota Provinsi', B['L2-2'], rD.length
    ? `<div class="scroll-list"><table class="mini"><thead><tr><th>Dari</th><th>Kabupaten/Kota tujuan</th><th class="n">Sekali jalan</th></tr></thead><tbody>${rD.map((r) => `<tr><td>${esc(r.v[1])}</td><td><a href="${link('L2-2', 0, r.c)}">${esc(r.v[2])}</a></td><td class="n">${money(tD, r.n[4])}</td></tr>`).join('')}</tbody></table></div>`
    : `<div class="callout">${ic('info')}<div>${pid === 'dki' ? 'DKI Jakarta diatur tersendiri: lihat Transport Jakarta ke Bodetabek di bawah.' : 'Provinsi ini tidak tercantum dalam tabel. Menurut Penjelasan, rute yang belum tercantum mengacu pada harga pasar (at cost).'}</div></div>`,
    `#/b/L2-2?t=0&p=${pid}`, rD.length ? `${rD.length} rute. Rute yang belum tercantum mengacu pada harga pasar (at cost).` : '');
  // Bodetabek (DKI)
  let cB = '';
  if (pid === 'dki') {
    const tB = B['L2-3'].tables[0];
    cB = card('Transport Jakarta ke Bodetabek', B['L2-3'], `<table class="mini"><tbody>${tB.rows.filter((r) => r.v).map((r) => `<tr><td>${esc(r.v[2])}</td><td class="n">${money(tB, r.n[4])}</td></tr>`).join('')}</tbody></table>`, '#/b/L2-3', 'Sekali jalan, lumpsum.');
  }
  // Tiket
  const tK = B['L2-6'].tables[0];
  const capU = p.kota[0].toUpperCase();
  const rK = tK.rows.filter((r) => r.v && (r.pa === pid || r.pt === pid))
    .sort((a, b) => ([b.v[1], b.v[2]].some((c) => c.toUpperCase() === capU) - [a.v[1], a.v[2]].some((c) => c.toUpperCase() === capU)));
  const cK = card('Tiket Pesawat (PP)', B['L2-6'], rK.length
    ? `<div class="scroll-list"><table class="mini"><thead><tr><th>Rute</th><th class="n">Bisnis</th><th class="n">Ekonomi</th></tr></thead><tbody>${rK.map((r) => `<tr><td><a href="${link('L2-6', 0, r.c)}">${esc(r.v[1])} ⇄ ${esc(r.v[2])}</a></td><td class="n">${money(tK, r.n[3])}</td><td class="n">${money(tK, r.n[4])}</td></tr>`).join('')}</tbody></table></div>`
    : `<div class="callout">${ic('info')}<div>Tidak ada rute yang menyentuh kota di provinsi ini dalam tabel tiket ${Y.srcKind}.</div></div>`,
    `#/b/L2-6?q=${encodeURIComponent(p.kota[0])}`, rK.length ? `${rK.length} rute yang asal atau tujuannya kota di provinsi ini. Dibayar riil.` : '');
  // Nasional
  const tR2 = B['L1-25'].tables[1];
  const cN = `<section class="card card-pad dcard"><div class="head"><h3>Berlaku nasional ${pid === 'dki' ? tip('Untuk transpor kegiatan dalam kota, DKI Jakarta dihitung satu kabupaten/kota (Jakarta Pusat, Timur, Utara, Barat, Selatan).') : ''}</h3></div><table class="mini"><tbody>
    <tr><td><a href="#/b/L2-4">Transpor kegiatan dalam kota (PP)</a></td><td class="n">${money(B['L2-4'].tables[0], firstVal(B['L2-4'].tables[0]))}</td></tr>
    <tr><td><a href="#/b/L1-29?t=1">Uang harian rapat fullboard</a></td><td class="n">${money(B['L1-29'].tables[1], B['L1-29'].tables[1].rows.find((r) => r.v).n[3])}</td></tr>
    ${tR2.rows.filter((r) => r.v).map((r) => `<tr><td><a href="#/b/L1-25?t=1">Representasi ${esc(r.v[1])}</a> ${tip('Luar kota / dalam kota lebih dari 8 jam')}</td><td class="n">${money(tR2, r.n[3])} / ${money(tR2, r.n[4])}</td></tr>`).join('')}
  </tbody></table></section>`;

  const html = `
  <div class="page-head">
    <div class="crumb"><a href="#/daerah">Daerah</a><span class="sep">›</span>Dalam Negeri</div>
    <h1 class="title">${esc(p.nama)}</h1>
    <p class="subtitle">Ibu kota: ${esc(p.kota[0])}. Semua satuan biaya yang ditetapkan per provinsi, sesuai ${Y.src}. Ketuk tautan Lamp. untuk melihat tabel lengkap dan penjelasannya.</p>
    <div class="actions"><a class="btn" href="#/bandingkan?p=${pid}">${ic('compare')} Bandingkan dengan provinsi lain</a></div>
  </div>
  ${effNotice()}
  <h2 class="sec">${ic('plane')} Perjalanan Dinas</h2>
  <div class="grid grid-2">${cUH}${cH}${cR}${cT}${cK}${cD}${cB}${cN}</div>
  <h2 class="sec">${ic('layers-2')} Satuan biaya lain di provinsi ini ${tip(`Semua tabel ${Y.srcKind} yang besarannya ditetapkan per provinsi, di luar perjalanan dinas. Ketuk judul bab untuk membuka.`)}</h2>
  <div class="grid">${provOthers(pid)}</div>`;
  return { html };
}

function provOthers(pid) {
  return BABS.filter((bb) => bb.key !== 'perjadin').map((bb) => {
    const cards = [];
    for (const it of bb.items) {
      for (const e of entriesOf(it.butir)) {
        if (cards.some((c) => c.key === e.key)) continue;
        const b = S.butir[e.butir];
        const t = b.tables[e.table];
        const r = t.rows.find((x) => x.v && x.p === pid);
        if (!t.rows.some((x) => x.v && x.p)) continue;
        const vc = valueCols(t);
        const ui = t.cols.findIndex((c) => /^satuan$/i.test(c));
        const grp = (() => { let g = ''; for (const x of t.rows) { if (x.g) g = x.g; if (x === r) return g; } return ''; })();
        const inner = r ? `<div class="kv">${vc.map((i) => `<div><div class="k">${esc(shortCol(t.cols[i]))}</div><div class="v">${money(t, r.n[i], r.cu || t.cur)}</div></div>`).join('')}</div>${ui >= 0 ? `<div class="kv-unit">Satuan: ${esc(r.v[ui])}${grp && !/^Rapat Biasa$/i.test(grp) ? '' : ''}</div>` : ''}` : '<p class="na">Tidak tercantum</p>';
        cards.push({ key: e.key, html: `<section class="card card-pad dcard"><div class="head"><h3>${ic(e.icon)} ${esc(e.name)}</h3><a class="more" href="#/b/${b.id}?t=${e.table}${r ? '&r=' + encodeURIComponent(r.c) : ''}">${lampShort(b)} ›</a></div>${inner}</section>` });
      }
    }
    if (!cards.length) return '';
    return fold(`${ic(bb.icon)} ${esc(bb.name)}`, `<div class="grid grid-2">${cards.map((c) => c.html).join('')}</div>`, { meta: cards.length + ' tabel' });
  }).join('');
}

/* ---------------- Bandingkan ---------------- */
function metrics() {
  const B = S.butir;
  const uh = B['L1-25'].tables[0], h = B['L1-27'].tables[0], tx = B['L2-5'].tables[0];
  const tiers = rapatTiers();
  const R = B['L1-29'].tables[0];
  const m = [];
  valueCols(uh).forEach((i) => m.push({ t: uh, g: 'Uang harian', l: shortCol(uh.cols[i]), f: (p) => uh.rows.find((r) => r.p === p)?.n[i] }));
  valueCols(h).forEach((i) => m.push({ t: h, g: 'Penginapan', l: shortCol(h.cols[i]), f: (p) => h.rows.find((r) => r.p === p)?.n[i] }));
  m.push({ t: tx, g: 'Taksi', l: 'Sekali jalan', f: (p) => tx.rows.find((r) => r.p === p)?.n[3] });
  tiers.forEach((tr, k) => valueCols(R).forEach((i) => m.push({ t: R, g: 'Paket rapat · ' + ['Menteri/Wamen', 'Eselon I–II/JF Utama', 'Eselon III ke bawah'][k], l: R.cols[i], f: (p) => tr.rows.find((r) => r.p === p)?.n[i] })));
  return m;
}
function viewCompare(params) {
  let sel = (params.p || '').split(',').filter((x) => S.prov[x]).slice(0, 3);
  const html = `
  <div class="page-head">
  <h1 class="title">Bandingkan Wilayah</h1><p class="subtitle">Pilih sampai 3 provinsi untuk membandingkan uang harian, penginapan, taksi, dan paket rapat. Uang harian, penginapan, dan paket rapat bersifat batas tertinggi; taksi dapat dilampaui.</p></div>
  <div class="tbl-tools">
    ${[0, 1, 2].map((k) => `<select class="sel" data-slot="${k}"><option value="">Pilih provinsi ${k + 1}</option>${S.provList.map((p) => `<option value="${p.id}"${sel[k] === p.id ? ' selected' : ''}>${esc(p.nama)}</option>`).join('')}</select>`).join('')}
  </div>
  <div id="cmpHost"></div>`;
  const after = () => {
    const draw = () => {
      const ps = sel.filter(Boolean);
      if (!ps.length) { $('#cmpHost').innerHTML = `<div class="empty">Pilih minimal satu provinsi.</div>`; return; }
      let g = '';
      const rows = metrics().map((m) => {
        const head = m.g !== g ? `<tr class="grp"><td colspan="${ps.length + 1}">${esc(m.g)}</td></tr>` : '';
        g = m.g;
        return head + `<tr><td class="lbl">${esc(m.l)}</td>${ps.map((p) => { const v = m.f(p); return `<td class="n">${v != null ? money(m.t, v) : '<span class="na">Tidak tercantum</span>'}</td>`; }).join('')}</tr>`;
      }).join('');
      $('#cmpHost').innerHTML = effNotice() + `<div class="tbl-wrap"><table class="t"><thead><tr><th>Komponen</th>${ps.map((p) => `<th class="n"><a href="#/daerah/p/${p}">${esc(S.prov[p].nama)}</a></th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
    };
    $$('[data-slot]').forEach((s) => s.onchange = () => {
      sel[Number(s.dataset.slot)] = s.value;
      history.replaceState(null, '', '#/bandingkan?p=' + sel.filter(Boolean).join(','));
      draw();
    });
    draw();
  };
  return { html, after };
}

/* ---------------- Tersimpan ---------------- */
function viewAlat() {
  const card = (t) => {
    const subs = (t.sub || []).map((x) => `<a class="al-sub" href="${x.h}">${ic(x.i)}<span><b>${esc(x.t)}</b><small>${esc(x.d)}</small></span></a>`).join('');
    return `<section class="card al-card${t.soon ? ' soon' : ''}">
      <a class="al-head" href="${t.h}"><span class="tool-ico">${ic(t.i)}</span><span class="al-tx"><b>${esc(t.t)}</b><small>${esc(t.d)}</small></span>${t.soon ? '<span class="chip">Segera hadir</span>' : ''}</a>
      ${subs ? `<div class="al-subs">${subs}</div>` : ''}
    </section>`;
  };
  return `<div class="page-head"><h1 class="title">Alat Bantu</h1><p class="subtitle">Alat hitung cepat untuk membantu tim keuangan menguji pengadaan dan pembayaran. Angka diambil dari SBM TA ${Y.y} yang sedang dipilih.</p></div>
  <div class="al-grid">${TOOLS.map(card).join('')}</div>`;
}
function viewPajak() {
  return `<div class="page-head"><h1 class="title">Perpajakan</h1><p class="subtitle">Kalkulator pajak atas pembayaran oleh bendahara.</p></div>
  <div class="callout">${ic('clock')}<div><b>Sedang disiapkan.</b> Ketentuan dan cara hitung tiap jenis pajak sedang disusun bersama tim Perbendaharaan, dan baru dibuka setelah diperiksa. Sampai saat itu, halaman ini belum menghitung apa pun.</div></div>
  <div class="card card-pad" style="margin-top:14px"><div class="group-title" style="margin:0 0 8px">Rencana isi</div>
    <ul class="plan-list">
      <li>PPN</li><li>PPh Pasal 21</li><li>PPh Pasal 22</li><li>PPh Pasal 23</li><li>PPh Pasal 4 ayat (2)</li>
    </ul>
  </div>
  <div class="actions" style="margin-top:14px"><a class="btn" href="#/alat">${ic('calculator')} Alat bantu lain</a></div>`;
}
function viewSaved() {
  const sv = saved().map(entry).filter(Boolean);
  return `<div class="page-head"><h1 class="title">Tersimpan</h1><p class="subtitle">Jenis satuan biaya yang Anda simpan. Tersimpan di perangkat ini.</p></div>
  ${sv.length ? `<div class="card list">${sv.map(entryRow).join('')}</div>` : `<div class="empty">Belum ada yang disimpan. Buka jenis satuan biaya lalu ketuk <b>Simpan</b>.</div>`}`;
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
    <div class="grid">
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
      <div class="card card-pad"><table class="plain"><tbody><tr><th colspan="2">Ikon</th></tr><tr><td>Sumber</td><td>Lucide (lucide.dev), lucide-static v1.75.0. Dilisensikan dengan ISC License, © Lucide Contributors. Disematkan di aplikasi agar berfungsi tanpa internet.</td></tr></tbody></table></div>
      <div class="callout">${ic('info')}<div>Seluruh angka diambil langsung dari tabel PDF PMK 32/2025 dan dicek silang dengan ekstraksi teks kedua (${Y.rows} baris data; semua nominal rupiah di tabel cocok dengan teks). Aplikasi ini alat bantu baca; untuk keperluan formal, rujuk dokumen aslinya.</div></div>
    </div>` };
  }
  if (sub === 'tentang') {
    return { html: `<div class="page-head">${back}<h1 class="title">Tentang dasar hukum</h1></div>
    <div class="grid">
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
    <a class="li" href="#/tersimpan">${ic('star', 'chev')}<div class="grow"><div class="t">Tersimpan</div></div>${ic('chev', 'chev')}</a>
    <a class="li" href="#/bandingkan">${ic('compare', 'chev')}<div class="grow"><div class="t">Bandingkan wilayah</div></div>${ic('chev', 'chev')}</a>
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
  const vh = window.innerHeight;
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
