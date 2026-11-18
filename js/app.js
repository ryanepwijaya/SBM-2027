import { ENTRIES, GROUPS, SHORTCUTS, SIFAT, KEL_ORDER, DOC_NOTES } from './catalog.js';
import { S, loadData, entry, entriesOf, esc, norm, ref, lampShort, fmt, valueCols, unitCol, shortCol, UNIT, rowsOfProv, rapatTiers, pdfLink, store } from './store.js';
import { search, buildIndex, SEARCH_HINTS } from './search.js';
import { ic } from './icons.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const NAV = [
  { k: 'beranda', h: '#/', t: 'Beranda', i: 'home' },
  { k: 'jelajah', h: '#/jelajah', t: 'Jelajah', i: 'compass' },
  { k: 'cari', h: '#/cari', t: 'Cari', i: 'search' },
  { k: 'daerah', h: '#/daerah', t: 'Daerah', i: 'map' },
  { k: 'lainnya', h: '#/lainnya', t: 'Lainnya', i: 'menu' },
];

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
const refChip = (b) => `<span class="chip ref">${lampShort(b)}</span>`;
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
  const nav = NAV.map((n) => `<a href="${n.h}" data-nav="${n.k}">${ic(n.i)}<span>${n.t}</span></a>`).join('');
  const bottom = NAV.map((n) => n.k === 'cari'
    ? `<a href="${n.h}" data-nav="${n.k}" class="search-fab"><span class="fab">${ic('search')}</span><span class="lbl">${n.t}</span></a>`
    : `<a href="${n.h}" data-nav="${n.k}">${ic(n.i)}<span>${n.t}</span></a>`).join('');
  const brand = `<a class="brand" href="#/"><span class="brand-mark"><span>SBM</span></span><span class="brand-text"><b>SBM 2027</b><small>PMK 54/2026 · KMK 296/2026</small></span></a>`;
  $('#app').innerHTML = `
  <aside class="sidebar">
    ${brand}
    <nav class="side-nav">${nav}<div class="sep"></div><a href="#/tersimpan" data-nav="tersimpan">${ic('star')}<span>Tersimpan</span></a><a href="#/bandingkan" data-nav="bandingkan">${ic('compare')}<span>Bandingkan Provinsi</span></a></nav>
    <div class="side-foot"><b>Tahap 1: Perjalanan Dinas</b><br>Standar Biaya Masukan TA 2027.<br>Kelompok lain menyusul.</div>
  </aside>
  <div class="content">
    <header class="topbar">
      ${brand}
      <label class="top-search" for="topq">${ic('search')}<input id="topq" type="search" placeholder="Cari satuan biaya, provinsi, kota, atau aturan…" autocomplete="off"><kbd>/</kbd></label>
      <span class="spacer"></span>
      <button class="icon-btn" id="themeBtn" data-theme-ico aria-label="Ganti tema"></button>
    </header>
    <main class="main" id="main" tabindex="-1"></main>
  </div>
  <nav class="bottomnav">${bottom}</nav>
  <div class="toast" id="toast" role="status"></div>`;
  $('#themeBtn').onclick = toggleTheme;
  const topq = $('#topq');
  topq.addEventListener('input', () => { location.hash = '#/cari?q=' + encodeURIComponent(topq.value); });
  topq.addEventListener('focus', () => { if (!location.hash.startsWith('#/cari')) location.hash = '#/cari?q=' + encodeURIComponent(topq.value); });
  document.addEventListener('keydown', (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
    if ((e.key === '/' && !typing) || (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      const box = $('#q') || (getComputedStyle($('.top-search')).display !== 'none' ? topq : null);
      if (box) box.focus(); else location.hash = '#/cari';
    }
  });
  applyTheme();
}

function setNav(k) {
  $$('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === k));
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
  let html = '';
  let after = null;
  try {
    switch (key) {
      case 'beranda': setNav('beranda'); html = viewHome(); after = afterHome; break;
      case 'jelajah': setNav('jelajah'); html = viewJelajah(); break;
      case 'segera': setNav('jelajah'); html = viewSoon(parts[1]); break;
      case 'b': setNav('jelajah'); ({ html, after } = viewButir(parts[1], params, anchor)); break;
      case 'cari': setNav('cari'); html = viewCari(params.q || ''); after = () => afterCari(params.q || ''); break;
      case 'daerah':
        setNav('daerah');
        if (parts[1] === 'p') ({ html, after } = viewProv(parts[2]));
        else ({ html, after } = viewDaerah(parts[1] === 'ln' ? 'ln' : 'dn', params));
        break;
      case 'bandingkan': setNav('bandingkan'); ({ html, after } = viewCompare(params)); break;
      case 'tersimpan': setNav('tersimpan'); html = viewSaved(); break;
      case 'lainnya': setNav('lainnya'); ({ html, after } = viewMore(parts[1])); break;
      default: html = `<div class="empty">Halaman tidak ditemukan. <a href="#/">Kembali ke Beranda</a></div>`;
    }
  } catch (err) {
    console.error(err);
    html = `<div class="empty">Terjadi kesalahan saat menampilkan halaman. <a href="#/">Kembali ke Beranda</a></div>`;
  }
  main.innerHTML = html + footer();
  if (pathKey !== lastPath) window.scrollTo(0, 0);
  lastPath = key === 'cari' ? 'cari' : pathKey;
  if (key !== 'cari') { const tq = $('#topq'); if (tq && document.activeElement !== tq) tq.value = ''; }
  if (after) after();
}

function footer() {
  return `<div class="foot">Sumber: PMK Nomor 54 Tahun 2026 tentang Standar Biaya Masukan dan KMK Nomor 296 Tahun 2026 tentang Rincian Besaran Standar Biaya Masukan (TA 2027).<br>Aplikasi bantu baca, bukan dokumen resmi. Untuk keperluan formal, rujuk dokumen aslinya.</div>`;
}

/* ---------------- Beranda ---------------- */
function viewHome() {
  const sc = SHORTCUTS.map((k) => {
    const e = entry(k); const b = S.butir[e.butir];
    return `<a class="sc" href="#/b/${e.butir}?t=${e.table}"><span class="ico">${ic(e.icon)}</span><b>${esc(e.name)}</b><small>${esc(e.desc)}</small></a>`;
  }).join('');
  const recent = store.get('recent', []).map(entry).filter(Boolean);
  const sv = saved().map(entry).filter(Boolean);
  const list = (arr) => `<div class="card list">${arr.map(entryRow).join('')}</div>`;
  return `
  <section class="hero">
    <h1>Standar Biaya Masukan TA 2027</h1>
    <p>Baca PMK 54/2026 dan KMK 296/2026 tanpa membuka PDF berhalaman-halaman.</p>
    <label class="hero-search" for="hq">${ic('search')}<input id="hq" type="search" placeholder="Ketik: uang harian jatim, penginapan, jakarta surabaya…" autocomplete="off" enterkeyhint="search"></label>
    <div class="hero-tags">${['perjadin', 'uang harian jatim', 'jakarta surabaya', 'fullboard', 'taksi bali'].map((h) => `<a href="#/cari?q=${encodeURIComponent(h)}">${esc(h)}</a>`).join('')}</div>
  </section>
  <h2 class="sec">Pintasan <small>Perjalanan dinas</small></h2>
  <div class="shortcuts">${sc}</div>
  ${recent.length ? `<h2 class="sec">${ic('clock')} Terakhir dilihat</h2>${list(recent)}` : ''}
  ${sv.length ? `<h2 class="sec">${ic('star')} Tersimpan</h2>${list(sv)}` : ''}
  <h2 class="sec">Cakupan aplikasi</h2>
  <div class="card card-pad">
    <div class="row" style="justify-content:space-between">
      <div><b>Tahap 1: Perjalanan Dinas</b><div class="muted small">13 jenis satuan biaya dari 12 butir KMK: dalam negeri, luar negeri, dan pindah.</div></div>
      <a class="btn" href="#/jelajah">${ic('compass')} Jelajah</a>
    </div>
    <div class="chips">${KEL_ORDER.filter((k) => k !== 'C').map((k) => `<a class="chip soon" href="#/segera/${k}">${esc(S.data.kelompok[k])} · segera hadir</a>`).join('')}</div>
  </div>`;
}
function afterHome() {
  const hq = $('#hq');
  hq.addEventListener('input', () => { location.hash = '#/cari?q=' + encodeURIComponent(hq.value); });
}
function entryRow(e) {
  const b = S.butir[e.butir];
  return `<a class="li" href="#/b/${e.butir}?t=${e.table}"><div class="grow"><div class="t">${esc(e.name)}</div><div class="d">${esc(e.desc)}</div><div class="chips" style="margin-top:6px">${sifatChip(b)}${refChip(b)}</div></div>${ic('chev', 'chev')}</a>`;
}

/* ---------------- Jelajah ---------------- */
function viewJelajah() {
  const groups = GROUPS.map((g) => {
    const items = ENTRIES.filter((e) => e.group === g.id);
    return `<div class="group-title">${esc(g.name)} <span class="count">${items.length}</span></div><div class="card list">${items.map(entryRow).join('')}</div>`;
  }).join('');
  const soon = KEL_ORDER.filter((k) => k !== 'C').map((k) => {
    const n = S.data.butir.filter((b) => b.kel === k).length;
    return `<a class="li soon" href="#/segera/${k}"><div class="grow"><div class="t">${esc(S.data.kelompok[k])}</div><div class="d">${n} butir · segera hadir</div></div>${ic('chev', 'chev')}</a>`;
  }).join('');
  return `
  <div class="page-head"><h1 class="title">Jelajah</h1><p class="subtitle">Satuan biaya perjalanan dinas, dikelompokkan menurut jenis perjalanan. Nomor butir mengikuti KMK 296/2026.</p></div>
  ${groups}
  <div class="group-title">Segera hadir</div>
  <div class="card list">${soon}</div>`;
}

function viewSoon(kel) {
  const name = S.data.kelompok[kel];
  if (!name) return `<div class="empty">Kelompok tidak ditemukan.</div>`;
  const items = S.data.butir.filter((b) => b.kel === kel);
  return `
  <div class="page-head"><div class="crumb"><a href="#/jelajah">Jelajah</a><span class="sep">›</span>Segera hadir</div>
  <h1 class="title">${esc(name)}</h1><p class="subtitle">Kelompok ini belum dibuka di aplikasi. Datanya sudah tersedia dan akan diaktifkan pada tahap berikutnya.</p></div>
  <div class="card list">${items.map((b) => `<div class="li soon"><div class="grow"><div class="t">${esc(b.title)}</div><div class="d">${lampShort(b)} · ${SIFAT[b.sifat].label}</div></div><span class="chip soon">Segera</span></div>`).join('')}</div>`;
}

/* ---------------- Tabel ---------------- */
function cellVal(t, r, i) {
  if (r.n && r.n[i] != null) return fmt(r.n[i], t.cur);
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
  const body = rows.length ? rows.map((r) => {
    if (r.g) return `<tr class="grp"><td colspan="${nCols}"><span class="gc">${esc(r.c)}</span>${esc(r.g)}</td></tr>`;
    const hl = opt.hl && r.c === opt.hl ? ' class="hl" id="hlrow"' : '';
    return `<tr${hl} data-code="${esc(r.c)}">${cols.map((x, k) => {
      if (x.i === 0 && hasCode) return `<td class="code">${esc(r.v[0] || '–')}</td>`;
      if (vc.has(x.i)) return `<td class="n">${cellVal(t, r, x.i)}</td>`;
      return `<td class="${k === 1 ? 'lbl sticky-col' : 'lbl'}">${esc(r.v[x.i])}</td>`;
    }).join('')}</tr>`;
  }).join('') : `<tr><td colspan="${nCols}" class="empty">Tidak ada baris yang cocok.</td></tr>`;
  const meta = [];
  if (uc && uc.unit) meta.push(`Satuan: <b>${esc(uc.unit)}</b>${UNIT[uc.unit] ? ' (' + UNIT[uc.unit] + ')' : ''}`);
  if (t.cur === 'USD') meta.push('Nilai dalam <b>US$</b>');
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
    return { html: `<div class="page-head"><div class="crumb"><a href="#/jelajah">Jelajah</a><span class="sep">›</span><a href="#/segera/${b.kel}">${esc(S.data.kelompok[b.kel])}</a></div><h1 class="title">${esc(b.title)}</h1><div class="chips">${sifatChip(b)}${refChip(b)}<span class="chip soon">Segera hadir</span></div></div><div class="callout">${ic('info')}<div>Butir ini belum dibuka pada tahap 1 (perjalanan dinas).</div></div>` };
  }
  const ents = entriesOf(id);
  let ti = Math.max(0, Math.min(Number(params.t || 0), b.tables.length - 1));
  let tier = params.tier != null ? Number(params.tier) : null;
  const e = ents.find((x) => x.table === ti) || ents[0];
  pushRecent(e.key);
  const g = groupOf(e.group);
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
    tabs = `<div class="tabs">${ents.map((x) => `<button class="tab${x.table === ti ? ' on' : ''}" data-t="${x.table}">${esc(x.name)}</button>`).join('')}</div>`;
  }

  const big = b.tables[ti].rows.length > 12;
  if (id === 'L2-2') {
    tools = `<div class="tbl-tools"><select class="sel" id="provSel"><option value="">Semua provinsi (31)</option>${[...new Set(b.tables[0].rows.filter((r) => r.p).map((r) => r.p))].map((p) => `<option value="${p}"${p === state.prov ? ' selected' : ''}>${esc(S.prov[p].nama)}</option>`).join('')}</select><label class="field">${ic('search')}<input id="tblq" type="search" placeholder="Cari kabupaten/kota…" value="${esc(state.filter)}"></label></div>`;
  } else if (id === 'L2-6') {
    tools = `<div class="tbl-tools"><label class="field">${ic('search')}<input id="tblq" type="search" placeholder="Cari kota, mis. surabaya atau jakarta makassar…" value="${esc(state.filter)}"></label></div>`;
  } else if (big && !(id === 'L1-29')) {
    tools = `<div class="tbl-tools"><label class="field">${ic('search')}<input id="tblq" type="search" placeholder="Saring baris tabel…" value="${esc(state.filter)}"></label></div>`;
  } else if (id === 'L1-29') {
    tools = `<div class="tbl-tools" id="rapatTools"><label class="field">${ic('search')}<input id="tblq" type="search" placeholder="Saring provinsi…" value="${esc(state.filter)}"></label></div>`;
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
    host.innerHTML = renderTable(t, { rows, filter, sort: state.sort, hl: params.r });
    scrollHint(host);
    $$('th.sortable', host).forEach((th) => th.onclick = () => {
      const i = Number(th.dataset.col);
      state.sort = state.sort && state.sort.i === i ? { i, dir: -state.sort.dir } : { i, dir: 1 };
      draw();
    });
  };

  const tierNote = id === 'L1-29' ? `<div class="callout" style="margin-bottom:12px">${ic('info')}<div>Tarif fullboard dihitung untuk 1 kamar berdua. Untuk eselon II/JF utama ke atas (1 kamar sendiri), indeks paling tinggi 1,5 kali tarif fullboard.</div></div>` : '';
  const points = e.points ? `<div class="card card-pad"><div class="reg"><h3>Poin penting</h3></div><ul class="points">${(id === 'L1-25' ? ents.flatMap((x) => x.points) : e.points).map((p) => `<li>${esc(p)}</li>`).join('')}</ul>${e.appNote ? `<div class="callout warn" style="margin-top:12px">${ic('alert')}<div>${esc(e.appNote)}</div></div>` : ''}<div class="points-note">Diringkas dari Penjelasan KMK 296/2026. Teks lengkap ada di bawah.</div></div>` : '';
  const pen = `<div class="card card-pad reg" id="pen"><h3>Penjelasan · KMK 296/2026</h3>${renderReg(b.pen, hlTokens)}<div class="src">${ref(b)} (Penjelasan atas Lampiran ${b.lamp === 1 ? 'I' : 'II'})</div></div>`;
  const def = `<div class="card card-pad" id="def"><div class="reg"><h3>Definisi · PMK 54/2026</h3></div><div class="def">${renderReg([{ t: 'p', x: b.def }], hlTokens)}</div><div class="src">Lampiran ${b.lamp === 1 ? 'I' : 'II'} PMK 54/2026 angka ${b.no}: ${esc(b.title)}</div></div>`;
  const others = ENTRIES.filter((x) => x.group === e.group && x.butir !== id);
  const related = others.length ? `<div class="card list"><div class="li" style="border:0"><div class="grow"><div class="t">Lainnya di ${esc(g.short)}</div></div></div>${others.map((x) => `<a class="li" href="#/b/${x.butir}?t=${x.table}"><div class="grow"><div class="t">${esc(x.name)}</div><div class="d">${esc(x.desc)}</div></div>${ic('chev', 'chev')}</a>`).join('')}</div>` : '';

  const title = id === 'L1-25' ? e.name : e.name;
  const html = `
  <div class="page-head">
    <div class="crumb"><a href="#/jelajah">Jelajah</a><span class="sep">›</span>${esc(g.name)}</div>
    <h1 class="title">${esc(title)}</h1>
    <p class="subtitle">${esc(b.title)}</p>
    <div class="chips">${sifatChip(b)}${refChip(b)}<a class="chip" href="${pdfLink(b)}" target="_blank" rel="noopener">${ic('file')} PDF ${pageRange(b)}</a></div>
    <div class="actions">
      <button class="btn${isSaved(e.key) ? ' on' : ''}" id="saveBtn">${ic('star')} <span>${isSaved(e.key) ? 'Tersimpan' : 'Simpan'}</span></button>
      <button class="btn" id="refBtn">${ic('copy')} Salin rujukan</button>
      ${navigator.share ? `<button class="btn" id="shareBtn">${ic('share')} Bagikan</button>` : ''}
    </div>
  </div>
  <div class="callout" style="margin-bottom:14px">${ic('info')}<div><b>${SIFAT[b.sifat].label}.</b> ${esc(SIFAT[b.sifat].text)}</div></div>
  <div class="butir-layout">
    <div class="butir-main">
      ${tabs}${tierNote}${tools}
      <div id="tblHost"></div>
      <div class="grid" style="margin-top:18px">${points}</div>
      <div class="grid hide-wide" style="margin-top:12px">${pen}${def}</div>
      <div style="margin-top:12px">${related}</div>
    </div>
    <aside class="butir-aside grid">${''}</aside>
  </div>`;

  const after = () => {
    // Di layar lebar, pindahkan poin penting & penjelasan ke kolom kanan
    const wide = window.matchMedia('(min-width: 1280px)').matches;
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
    $('#saveBtn').onclick = () => {
      const on = toggleSaved(e.key);
      $('#saveBtn').classList.toggle('on', on);
      $('#saveBtn span').textContent = on ? 'Tersimpan' : 'Simpan';
      toast(on ? 'Disimpan' : 'Dihapus dari tersimpan');
    };
    $('#refBtn').onclick = () => copy(`${ref(b, { code: params.r || b.no })} (${e.name})`, 'Rujukan disalin');
    const sh = $('#shareBtn');
    if (sh) sh.onclick = () => navigator.share({ title: e.name + ' — SBM 2027', url: location.href }).catch(() => {});
    const hl = $('#hlrow');
    if (hl) setTimeout(() => hl.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60);
    else if (anchor) { const el = document.getElementById(anchor); if (el) setTimeout(() => el.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60); }
  };
  return { html, after };
}

/* ---------------- Cari ---------------- */
function viewCari(q) {
  return `
  <div class="page-head"><h1 class="title">Cari</h1><p class="subtitle">Ketik jenis biaya, provinsi, kota, atau kata dalam aturan. Contoh: <i>penginapan jatim</i>, <i>jakarta surabaya</i>, <i>60%</i>.</p></div>
  <div class="search-box">${ic('search')}<input id="q" type="search" value="${esc(q)}" placeholder="Cari di SBM 2027…" autocomplete="off" enterkeyhint="search" aria-label="Cari"><button id="qClear" aria-label="Hapus">${ic('x')}</button></div>
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
      <div class="res-group"><div class="res-title">Coba cari</div><div class="hint-list">${SEARCH_HINTS.map((h) => `<a href="#/cari?q=${encodeURIComponent(h)}">${esc(h)}</a>`).join('')}</div></div>
      <div class="res-group"><div class="res-title">Atau buka langsung</div><div class="card list">${SHORTCUTS.slice(0, 6).map((k) => entryRow(entry(k))).join('')}</div></div>`;
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
  if (r.soon.length) html += `<div class="res-group"><div class="res-title">Belum tersedia di versi ini</div><div class="card list">${r.soon.map((b) => `<a class="li soon" href="#/segera/${b.kel}"><div class="grow"><div class="t">${esc(b.title)}</div><div class="d">${esc(S.data.kelompok[b.kel])} · ${lampShort(b)}</div></div><span class="chip soon">Segera</span></a>`).join('')}</div></div>`;
  if (!html || (!r.best.length && !r.menus.length && !r.rows.length && !r.pens.length && !r.soon.length)) {
    html += `<div class="empty">Tidak ada hasil untuk <b>${esc(q)}</b>.<br><span class="small">Coba kata lain, mis. nama provinsi, kota, atau jenis biaya.</span></div>`;
  }
  host.innerHTML = html;
}

/* ---------------- Daerah ---------------- */
function viewDaerah(mode, params) {
  const seg = `<div class="seg"><a href="#/daerah" class="${mode === 'dn' ? 'on' : ''}">Dalam Negeri</a><a href="#/daerah/ln" class="${mode === 'ln' ? 'on' : ''}">Luar Negeri</a></div>`;
  if (mode === 'dn') {
    const html = `
    <div class="page-head"><h1 class="title">Daerah</h1><p class="subtitle">Pilih provinsi untuk melihat semua satuan biaya perjalanan dinasnya dalam satu halaman.</p></div>
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
  <div class="page-head"><h1 class="title">Daerah</h1><p class="subtitle">Uang harian per negara dan tiket pesawat per kota tujuan, dalam US$.</p></div>
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
  const card = (title, b, inner, more, note) => `<section class="card card-pad dcard"><div class="head"><h3>${esc(title)} ${sifatChip(b)}</h3><a class="more" href="${more}">${lampShort(b)} ›</a></div>${inner}${note ? `<div class="note">${note}</div>` : ''}</section>`;
  const kv = (t, r, idxs) => `<div class="kv">${idxs.map((i) => `<div><div class="k">${esc(shortCol(t.cols[i]))}</div><div class="v">${fmt(r.n[i], t.cur)}</div></div>`).join('')}</div>`;

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
  const cT = card('Taksi ke/dari Bandara, Stasiun, Terminal', B['L2-5'], rT ? `<div class="kv"><div><div class="k">Sekali jalan (lumpsum)</div><div class="v">${fmt(rT.n[3])}</div></div></div>` : `<div class="callout warn">${ic('alert')}<div>Provinsi ini tidak tercantum dalam tabel Lampiran II angka 5 KMK 296/2026.</div></div>`, link('L2-5', 0, rT?.c),
    'Bila melebihi, dapat dibayar riil sepanjang dari/ke kantor dan bukan kendaraan pribadi.');
  // Paket rapat
  const tiers = rapatTiers();
  const tR = B['L1-29'].tables[0];
  const rapRows = tiers.map((tr) => ({ name: tr.name, r: tr.rows.find((x) => x.p === pid) }));
  const vcR = valueCols(tR);
  const cR = card('Paket Rapat di Luar Kantor', B['L1-29'], `<div style="overflow:auto"><table class="mini"><thead><tr><th>Tingkat peserta</th>${vcR.map((i) => `<th class="n">${esc(tR.cols[i])}</th>`).join('')}</tr></thead><tbody>${rapRows.map((x) => `<tr><td>${esc(x.name)}</td>${vcR.map((i) => `<td class="n">${x.r ? fmt(x.r.n[i]) : '–'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`,
    link('L1-29', 0, rapRows[2].r?.c), 'Per orang per paket. Uang harian rapat Rp130.000/OH hanya untuk fullboard (berlaku nasional). Eselon II ke atas: fullboard dapat 1,5×.');
  // Transport darat
  const tD = B['L2-2'].tables[0];
  const rD = tD.rows.filter((r) => r.v && r.p === pid);
  const cD = card('Transport Darat dari Ibu Kota Provinsi', B['L2-2'], rD.length
    ? `<div class="scroll-list"><table class="mini"><thead><tr><th>Dari</th><th>Kabupaten/Kota tujuan</th><th class="n">Sekali jalan</th></tr></thead><tbody>${rD.map((r) => `<tr><td>${esc(r.v[1])}</td><td><a href="${link('L2-2', 0, r.c)}">${esc(r.v[2])}</a></td><td class="n">${fmt(r.n[4])}</td></tr>`).join('')}</tbody></table></div>`
    : `<div class="callout">${ic('info')}<div>${pid === 'dki' ? 'DKI Jakarta diatur tersendiri: lihat Transport Jakarta ke Bodetabek di bawah.' : 'Provinsi ini tidak tercantum dalam tabel. Menurut Penjelasan, rute yang belum tercantum mengacu pada harga pasar (at cost).'}</div></div>`,
    `#/b/L2-2?t=0&p=${pid}`, rD.length ? `${rD.length} rute. Rute yang belum tercantum mengacu pada harga pasar (at cost).` : '');
  // Bodetabek (DKI)
  let cB = '';
  if (pid === 'dki') {
    const tB = B['L2-3'].tables[0];
    cB = card('Transport Jakarta ke Bodetabek', B['L2-3'], `<table class="mini"><tbody>${tB.rows.filter((r) => r.v).map((r) => `<tr><td>${esc(r.v[2])}</td><td class="n">${fmt(r.n[4])}</td></tr>`).join('')}</tbody></table>`, '#/b/L2-3', 'Sekali jalan, lumpsum.');
  }
  // Tiket
  const tK = B['L2-6'].tables[0];
  const rK = tK.rows.filter((r) => r.v && (r.pa === pid || r.pt === pid));
  const cK = card('Tiket Pesawat (PP)', B['L2-6'], rK.length
    ? `<div class="scroll-list"><table class="mini"><thead><tr><th>Rute</th><th class="n">Bisnis</th><th class="n">Ekonomi</th></tr></thead><tbody>${rK.map((r) => `<tr><td><a href="${link('L2-6', 0, r.c)}">${esc(r.v[1])} ⇄ ${esc(r.v[2])}</a></td><td class="n">${fmt(r.n[3])}</td><td class="n">${fmt(r.n[4])}</td></tr>`).join('')}</tbody></table></div>`
    : `<div class="callout">${ic('info')}<div>Tidak ada rute yang menyentuh kota di provinsi ini dalam tabel tiket KMK.</div></div>`,
    `#/b/L2-6?q=${encodeURIComponent(p.kota[0])}`, rK.length ? `${rK.length} rute yang asal atau tujuannya kota di provinsi ini. Dibayar riil.` : '');
  // Nasional
  const tR2 = B['L1-25'].tables[1];
  const cN = `<section class="card card-pad dcard"><div class="head"><h3>Berlaku nasional</h3></div><table class="mini"><tbody>
    <tr><td><a href="#/b/L2-4">Transpor kegiatan dalam kota (PP)</a> ${sifatChip(B['L2-4'])}</td><td class="n">${fmt(B['L2-4'].tables[0].rows[0].n[2])}</td></tr>
    <tr><td><a href="#/b/L1-29?t=1">Uang harian rapat fullboard</a> ${sifatChip(B['L1-29'])}</td><td class="n">${fmt(B['L1-29'].tables[1].rows.find((r) => r.v).n[3])}</td></tr>
    ${tR2.rows.filter((r) => r.v).map((r) => `<tr><td><a href="#/b/L1-25?t=1">Representasi ${esc(r.v[1])}</a> <span class="muted small">luar kota / dalam kota >8 jam</span></td><td class="n">${fmt(r.n[3])} / ${fmt(r.n[4])}</td></tr>`).join('')}
  </tbody></table>${pid === 'dki' ? '<div class="note">Untuk transpor kegiatan dalam kota, DKI Jakarta dihitung satu kabupaten/kota (Jakarta Pusat, Timur, Utara, Barat, Selatan).</div>' : ''}</section>`;

  const html = `
  <div class="page-head">
    <div class="crumb"><a href="#/daerah">Daerah</a><span class="sep">›</span>Dalam Negeri</div>
    <h1 class="title">${esc(p.nama)}</h1>
    <p class="subtitle">Ibu kota: ${esc(p.kota[0])}. Semua angka sesuai KMK 296/2026; ketuk tautan untuk melihat tabel lengkap dan penjelasannya.</p>
    <div class="actions"><a class="btn" href="#/bandingkan?p=${pid}">${ic('compare')} Bandingkan dengan provinsi lain</a></div>
  </div>
  <div class="grid grid-2">${cUH}${cH}${cR}${cT}${cK}${cD}${cB}${cN}</div>`;
  return { html };
}

/* ---------------- Bandingkan ---------------- */
function metrics() {
  const B = S.butir;
  const uh = B['L1-25'].tables[0], h = B['L1-27'].tables[0], tx = B['L2-5'].tables[0];
  const tiers = rapatTiers();
  const R = B['L1-29'].tables[0];
  const m = [];
  valueCols(uh).forEach((i) => m.push({ g: 'Uang harian', l: shortCol(uh.cols[i]), f: (p) => uh.rows.find((r) => r.p === p)?.n[i] }));
  valueCols(h).forEach((i) => m.push({ g: 'Penginapan', l: shortCol(h.cols[i]), f: (p) => h.rows.find((r) => r.p === p)?.n[i] }));
  m.push({ g: 'Taksi', l: 'Sekali jalan', f: (p) => tx.rows.find((r) => r.p === p)?.n[3] });
  tiers.forEach((tr, k) => valueCols(R).forEach((i) => m.push({ g: 'Paket rapat · ' + ['Menteri/Wamen', 'Eselon I–II/JF Utama', 'Eselon III ke bawah'][k], l: R.cols[i], f: (p) => tr.rows.find((r) => r.p === p)?.n[i] })));
  return m;
}
function viewCompare(params) {
  let sel = (params.p || '').split(',').filter((x) => S.prov[x]).slice(0, 3);
  const html = `
  <div class="page-head"><div class="crumb"><a href="#/daerah">Daerah</a><span class="sep">›</span>Bandingkan</div>
  <h1 class="title">Bandingkan Provinsi</h1><p class="subtitle">Pilih sampai 3 provinsi untuk membandingkan uang harian, penginapan, taksi, dan paket rapat.</p></div>
  <div class="tbl-tools">
    ${[0, 1, 2].map((k) => `<select class="sel" data-slot="${k}"><option value="">— Pilih provinsi ${k + 1} —</option>${S.provList.map((p) => `<option value="${p.id}"${sel[k] === p.id ? ' selected' : ''}>${esc(p.nama)}</option>`).join('')}</select>`).join('')}
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
        return head + `<tr><td class="lbl">${esc(m.l)}</td>${ps.map((p) => { const v = m.f(p); return `<td class="n">${v != null ? fmt(v) : '<span class="na">Tidak tercantum</span>'}</td>`; }).join('')}</tr>`;
      }).join('');
      $('#cmpHost').innerHTML = `<div class="tbl-wrap"><table class="t"><thead><tr><th>Komponen</th>${ps.map((p) => `<th class="n"><a href="#/daerah/p/${p}">${esc(S.prov[p].nama)}</a></th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
      <p class="muted small" style="margin-top:10px">Angka sesuai KMK 296/2026. Uang harian, penginapan, dan paket rapat bersifat batas tertinggi; taksi dapat dilampaui.</p>`;
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
function viewSaved() {
  const sv = saved().map(entry).filter(Boolean);
  return `<div class="page-head"><h1 class="title">Tersimpan</h1><p class="subtitle">Jenis satuan biaya yang Anda simpan. Tersimpan di perangkat ini.</p></div>
  ${sv.length ? `<div class="card list">${sv.map(entryRow).join('')}</div>` : `<div class="empty">Belum ada yang disimpan. Buka jenis satuan biaya lalu ketuk <b>Simpan</b>.</div>`}`;
}

/* ---------------- Lainnya ---------------- */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; });

function viewMore(sub) {
  const M = S.data.meta;
  const back = `<div class="crumb"><a href="#/lainnya">Lainnya</a></div>`;
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
      <div class="callout">${ic('info')}<div>Seluruh angka diambil langsung dari tabel PDF KMK 296/2026 dan dicek silang dengan ekstraksi teks kedua (3.168 baris bernomor cocok). Aplikasi ini alat bantu baca; untuk keperluan formal, rujuk dokumen aslinya.</div></div>
    </div>` };
  }
  if (sub === 'catatan') {
    const CU = S.data.catatan_umum;
    const tol = S.data.toleransi;
    return { html: `<div class="page-head">${back}<h1 class="title">Catatan Umum KMK</h1><p class="subtitle">Catatan di akhir Lampiran I dan Lampiran II KMK 296/2026.</p></div>
    <div class="grid">
      <div class="card card-pad reg"><h3>Catatan Umum Lampiran I</h3>${renderReg(CU.L1)}<p class="blk l1"><span class="m">5.</span>untuk satuan biaya pengadaan kendaraan operasional bus, sewa kendaraan, pengadaan kendaraan operasional kantor dan/atau lapangan roda 2 dan roda 4, pengadaan pakaian dinas, dan konsumsi rapat pada beberapa kabupaten diberikan toleransi pengusulan satuan biaya melebihi ketentuan (lihat tabel di bawah).</p></div>
      <div class="card card-pad reg"><h3>Catatan Umum Lampiran II</h3>${renderReg(CU.L2)}<p class="blk l1"><span class="m">3.</span>Untuk satuan biaya pemeliharaan dan operasional kendaraan dinas, pemeliharaan sarana kantor, penggantian inventaris lama dan/atau pembelian inventaris untuk pegawai baru, pengadaan bahan makanan, sewa mesin fotokopi, dan pemeliharaan gedung/bangunan dalam negeri, pada beberapa kabupaten diberikan toleransi pengusulan satuan biaya melebihi ketentuan (lihat tabel di bawah).</p></div>
      <div class="card card-pad"><div class="reg"><h3>Toleransi kabupaten tertentu</h3></div>
        <div class="callout warn" style="margin-bottom:12px">${ic('alert')}<div>Toleransi ini <b>tidak berlaku untuk satuan biaya perjalanan dinas</b> (uang harian, penginapan, paket rapat, transportasi, tiket). Hanya untuk satuan biaya yang disebut pada butir 5 (Lampiran I) dan butir 3 (Lampiran II) di atas.</div></div>
        <table class="plain"><thead><tr><th>Provinsi</th><th>Kabupaten</th><th style="text-align:right">Toleransi</th></tr></thead><tbody>${tol.map((t) => `<tr><td>${esc(t[0])}</td><td>${esc(t[1])}</td><td style="text-align:right" class="tnum"><b>${t[2]}%</b></td></tr>`).join('')}</tbody></table>
        <div class="src">Persentase dari satuan biaya provinsi yang bersangkutan.</div></div>
    </div>` };
  }
  if (sub === 'singkatan') {
    return { html: `<div class="page-head">${back}<h1 class="title">Daftar singkatan satuan</h1></div><div class="card card-pad"><table class="plain"><tbody>${S.data.singkatan.map((s) => `<tr><td><b>${esc(s[0])}</b></td><td>${esc(s[1])}</td></tr>`).join('')}</tbody></table><div class="src">Pengertian Istilah, KMK 296/2026.</div></div>` };
  }
  if (sub === 'dokumen') {
    return { html: `<div class="page-head">${back}<h1 class="title">Catatan atas dokumen</h1><p class="subtitle">Hal-hal di dokumen KMK yang perlu diketahui saat membaca aplikasi ini.</p></div><div class="card list">${DOC_NOTES.map((d) => `<div class="li"><div class="grow"><div class="t">${esc(d.t)}</div><div class="d">${esc(d.x)}</div></div></div>`).join('')}</div>` };
  }
  const pref = store.get('theme', 'system');
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const html = `
  <div class="page-head"><h1 class="title">Lainnya</h1></div>
  <div class="group-title">Tampilan</div>
  <div class="card card-pad"><div class="theme-pick">
    <button data-th="light" class="${pref === 'light' ? 'on' : ''}">${ic('sun')} Terang</button>
    <button data-th="dark" class="${pref === 'dark' ? 'on' : ''}">${ic('moon')} Gelap</button>
    <button data-th="system" class="${pref === 'system' ? 'on' : ''}">${ic('monitor')} Otomatis</button>
  </div></div>
  <div class="group-title">Menu</div>
  <div class="card list">
    <a class="li" href="#/tersimpan">${ic('star', 'chev')}<div class="grow"><div class="t">Tersimpan</div><div class="d">${saved().length} jenis satuan biaya</div></div>${ic('chev', 'chev')}</a>
    <a class="li" href="#/bandingkan">${ic('compare', 'chev')}<div class="grow"><div class="t">Bandingkan provinsi</div><div class="d">Uang harian, penginapan, taksi, paket rapat</div></div>${ic('chev', 'chev')}</a>
    <a class="li" href="#/lainnya/catatan">${ic('list', 'chev')}<div class="grow"><div class="t">Catatan Umum KMK</div><div class="d">Efisiensi, mekanisme perjalanan dinas, toleransi kabupaten</div></div>${ic('chev', 'chev')}</a>
    <a class="li" href="#/lainnya/singkatan">${ic('book', 'chev')}<div class="grow"><div class="t">Daftar singkatan</div><div class="d">OH, OB, OJ, OP, OK, dan lainnya</div></div>${ic('chev', 'chev')}</a>
    <a class="li" href="#/lainnya/dokumen">${ic('alert', 'chev')}<div class="grow"><div class="t">Catatan atas dokumen</div><div class="d">Data tidak tercantum, salah cetak, dan penyeragaman ejaan</div></div>${ic('chev', 'chev')}</a>
    <a class="li" href="#/lainnya/tentang">${ic('info', 'chev')}<div class="grow"><div class="t">Tentang PMK 54/2026 & KMK 296/2026</div><div class="d">Dasar hukum, tanggal, dan unduh PDF asli</div></div>${ic('chev', 'chev')}</a>
  </div>
  <div class="group-title">Aplikasi</div>
  <div class="card card-pad">
    ${isStandalone ? '<div class="muted">Aplikasi sudah terpasang di perangkat ini.</div>' : `<div class="row" style="justify-content:space-between"><div><b>Pasang di perangkat</b><div class="muted small">Buka lebih cepat dan tetap bisa dipakai tanpa internet.</div></div><button class="btn primary" id="installBtn">${ic('phone')} Pasang</button></div><div class="muted small" id="installHelp" style="margin-top:10px;display:none">Di Chrome HP: ketuk menu ⋮ lalu pilih <b>Tambahkan ke layar utama</b> / <b>Instal aplikasi</b>. Di PC: klik ikon pasang di kolom alamat.</div>`}
  </div>
  <div class="group-title">Cakupan</div>
  <div class="card list">${KEL_ORDER.map((k) => `<a class="li${k === 'C' ? '' : ' soon'}" href="${k === 'C' ? '#/jelajah' : '#/segera/' + k}"><div class="grow"><div class="t">${esc(S.data.kelompok[k])}</div><div class="d">${S.data.butir.filter((b) => b.kel === k).length} butir</div></div>${k === 'C' ? '<span class="chip dl">Tersedia</span>' : '<span class="chip soon">Segera</span>'}</a>`).join('')}</div>`;
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

/* ---------------- Mulai ---------------- */
async function start() {
  shell();
  $('#main').innerHTML = `<div class="empty">Memuat data…</div>`;
  try {
    await loadData();
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
