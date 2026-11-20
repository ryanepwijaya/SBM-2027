// Perubahan SBM (tahun sebelumnya → tahun terpilih) dan Unduh Tabel Biaya (Excel).
// Perubahan: baris dicocokkan per butir/tabel memakai provinsi atau teks uraian (kode butir berbeda antartahun);
// sisa baris yang uraiannya berubah dipasangkan berurutan bila jumlahnya sama.
import { S, Y, YEARS, esc, fmt, norm, valueCols, shortCol, unitCol, store, tip } from './store.js';
import { ENTRIES } from './catalog.js';
import { BABS, babOfButir } from './bab.js';
import { ic } from './icons.js';
import { loadScript } from './hitung.js';

const cache = {};
async function loadYear(y) {
  if (!cache[y]) cache[y] = fetch(YEARS[y].data).then((r) => r.json());
  return cache[y];
}
const isNum = (s) => /^(rp|\$|us\$)?\s*[\d.,]+$/i.test(String(s).trim());
export function tableName(bid, ti, b = S.butir[bid]) {
  const e = ENTRIES.find((x) => x.butir === bid && x.table === ti) || (b.tables.length === 1 ? ENTRIES.find((x) => x.butir === bid) : null);
  if (e) return e.tab || e.name;
  const g = b.tables[ti].rows.find((r) => r.g);
  return b.tables.length > 1 && g ? `${b.title} · ${g.g}` : b.title;
}
const lampRef = (b) => `${b.lamp === 1 ? 'Lamp. I' : 'Lamp. II'} angka ${b.no}`;

function rowsOf(t) {
  const vc = valueCols(t);
  const ui = unitCol(t)?.i;
  const out = [];
  let ctx = '';
  for (const r of t.rows) {
    if (r.g) { ctx = r.g; continue; }
    if (!r.n || !r.v) continue;
    const pn = r.p ? norm(S.prov[r.p]?.nama || '') : null;
    const texts = r.v.filter((x, i) => i > 0 && !vc.includes(i) && i !== ui && x && !isNum(x) && norm(x) !== pn);
    const key = `${norm(ctx)}#${r.p ? 'p:' + r.p : 't:' + norm(texts.join(' '))}`;
    out.push({ r, key, ctx, texts });
  }
  return out;
}
function pairRows(ta, tb) {
  const A = rowsOf(ta), B = rowsOf(tb);
  const used = new Set();
  const byKey = new Map();
  A.forEach((x, i) => { if (!byKey.has(x.key)) byKey.set(x.key, []); byKey.get(x.key).push(i); });
  const pairs = [];
  const leftB = [];
  for (const y of B) {
    const list = byKey.get(y.key);
    const i = list?.find((j) => !used.has(j));
    if (i != null) { used.add(i); pairs.push([A[i], y]); } else leftB.push(y);
  }
  const leftA = A.filter((_, i) => !used.has(i));
  if (leftA.length && leftA.length === leftB.length) { leftA.forEach((x, i) => pairs.push([x, leftB[i], true])); return { pairs, onlyA: [], onlyB: [] }; }
  return { pairs, onlyA: leftA, onlyB: leftB };
}
let DIFF = null;
async function buildDiff(y) {
  if (DIFF && DIFF.y === y) return DIFF.items;
  const [A, B] = await Promise.all([loadYear(y - 1), loadYear(y)]);
  const a = Object.fromEntries(A.butir.map((x) => [x.id, x]));
  const items = [];
  for (const b of B.butir) {
    const ba = a[b.id];
    if (!ba) continue;
    const bab = babOfButir(b.id);
    b.tables.forEach((tb, ti) => {
      const ta = ba.tables[ti];
      if (!ta) return;
      const vc = valueCols(tb);
      const name = tableName(b.id, ti, S.butir[b.id] || b);
      const push = (ra, rb, relabel) => {
        const base = rb || ra;
        const label = [base.ctx && !base.r.p ? base.ctx : '', ...base.texts].filter(Boolean).join(' · ');
        for (const ci of vc) {
          const x = ra ? ra.r.n[ci] : null, y = rb ? rb.r.n[ci] : null;
          if (x == null && y == null) continue;
          const cur = (rb || ra).r.cu || tb.cur;
          const kind = x == null ? 'baru' : y == null ? 'hapus' : y > x ? 'naik' : y < x ? 'turun' : 'tetap';
          items.push({
            bid: b.id, ti, bab: bab?.key || '', babN: bab?.short || '', name, ref: lampRef(b), label, prov: base.r.p ? S.prov[base.r.p]?.nama || '' : '',
            col: vc.length > 1 ? shortCol(tb.cols[ci]) : '', a: x, b: y, cur, kind, relabel: !!relabel,
            diff: x != null && y != null ? y - x : null, pct: x && y != null ? ((y - x) / x) * 100 : null,
            s: norm(`${name} ${label} ${base.r.p ? S.prov[base.r.p]?.nama : ''} ${tb.cols[ci]} ${bab?.name || ''}`),
          });
        }
      };
      const { pairs, onlyA, onlyB } = pairRows(ta, tb);
      for (const [x, y, rel] of pairs) push(x, y, rel);
      for (const x of onlyA) push(x, null);
      for (const y of onlyB) push(null, y);
    });
  }
  DIFF = { y, items };
  return items;
}
const KINDS = [['ubah', 'Semua yang berubah'], ['naik', 'Naik'], ['turun', 'Turun'], ['baru', 'Baru'], ['hapus', 'Dihapus'], ['tetap', 'Tetap']];
const pctTxt = (p) => (p == null ? '' : `${p > 0 ? '+' : ''}${p.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`);
const money = (n, cur) => (n == null ? '–' : fmt(n, cur));

export function viewPerubahan(ui) {
  // Pembanding = tahun anggaran sebelum tahun yang sedang dipilih; bila tidak ada datanya, halaman kosong
  const prev = Y.y - 1;
  if (!YEARS[prev]) {
    const later = Object.keys(YEARS).map(Number).filter((y) => YEARS[y - 1]).sort().pop();
    return { html: `<div class="page-head"><h1 class="title">Perubahan SBM</h1><p class="subtitle">Perbandingan satuan biaya dengan tahun anggaran sebelumnya.</p></div>
      <div class="empty">${ic('git-compare')}<p><b>Belum ada pembanding untuk TA ${Y.y}.</b> Data SBM TA ${prev} tidak tersedia di aplikasi ini.</p>${later ? `<a class="btn primary" href="?tahun=${later}#/perubahan">${ic('git-compare')} Lihat perubahan TA ${later - 1} → ${later}</a>` : ''}</div>`, after: null };
  }
  const st = { kind: 'ubah', bab: '', q: '', sort: 'bab', limit: 300, ...store.get('perubahan', {}) };
  st.limit = 300;
  const html = `<div class="page-head"><h1 class="title">Perubahan SBM</h1><p class="subtitle">Bandingkan besaran ${esc(YEARS[prev].src)} (TA ${prev}) dengan ${esc(Y.src)} (TA ${Y.y}): mana yang naik, turun, baru, atau dihapus, lengkap dengan selisih rupiah dan persentasenya. Baris dicocokkan per provinsi atau uraian; bila uraian berubah redaksi, baris tetap dipasangkan.</p></div>
  <div id="pbHost"><div class="empty small">Memuat data dua tahun anggaran…</div></div>`;
  const save = () => store.set('perubahan', { kind: st.kind, bab: st.bab, sort: st.sort });
  const after = async () => {
    let items;
    try { items = await buildDiff(Y.y); } catch (e) { console.error(e); ui.$('#pbHost').innerHTML = '<div class="empty small">Data gagal dimuat. Periksa koneksi lalu muat ulang.</div>'; return; }
    const host = ui.$('#pbHost');
    const count = (k) => items.filter((x) => (k === 'ubah' ? x.kind !== 'tetap' : x.kind === k)).length;
    host.innerHTML = `<div class="pb-sum">${KINDS.slice(1).map(([k, n]) => `<button type="button" class="pb-stat k-${k}" data-kind="${k}"><b>${count(k).toLocaleString('id-ID')}</b><span>${n}</span></button>`).join('')}</div>
      <div class="card pb-card">
        <div class="pb-tools">
          <label class="pb-q">${ic('search')}<input id="pbQ" type="search" placeholder="Cari satuan biaya, provinsi, atau uraian…" value="${esc(st.q)}" autocomplete="off"></label>
          <select class="sel" id="pbKind" aria-label="Jenis perubahan">${KINDS.map(([k, n]) => `<option value="${k}"${k === st.kind ? ' selected' : ''}>${n}</option>`).join('')}</select>
          <select class="sel" id="pbBab" aria-label="Bab"><option value="">Semua bab</option>${BABS.map((b) => `<option value="${b.key}"${b.key === st.bab ? ' selected' : ''}>${esc(b.name)}</option>`).join('')}</select>
          <select class="sel" id="pbSort" aria-label="Urutan"><option value="bab"${st.sort === 'bab' ? ' selected' : ''}>Urut bab</option><option value="up"${st.sort === 'up' ? ' selected' : ''}>Kenaikan terbesar (%)</option><option value="down"${st.sort === 'down' ? ' selected' : ''}>Penurunan terbesar (%)</option></select>
          <button type="button" class="btn primary" id="pbXls">${ic('file-spreadsheet')} Unduh Excel</button>
        </div>
        <div id="pbList"></div>
      </div>
      <div class="kp-foot muted small pb-foot">Perbandingan dari data yang diekstrak aplikasi ini; cek angka resminya di PMK/KMK. Selisih dihitung dari besaran SBM, bukan dari persentase dibayar.</div>`;
    const order = Object.fromEntries(BABS.map((b, i) => [b.key, i]));
    const filtered = () => {
      const q = norm(st.q).split(' ').filter(Boolean);
      let r = items.filter((x) => (st.kind === 'ubah' ? x.kind !== 'tetap' : x.kind === st.kind) && (!st.bab || x.bab === st.bab) && q.every((t) => x.s.includes(t)));
      if (st.sort === 'up') r = r.sort((a, b) => (b.pct ?? -1e9) - (a.pct ?? -1e9));
      else if (st.sort === 'down') r = r.sort((a, b) => (a.pct ?? 1e9) - (b.pct ?? 1e9));
      else r = r.sort((a, b) => (order[a.bab] ?? 9) - (order[b.bab] ?? 9) || a.bid.localeCompare(b.bid, 'en', { numeric: true }) || a.ti - b.ti);
      return r;
    };
    const draw = () => {
      const r = filtered();
      const shown = r.slice(0, st.limit);
      let lastG = '';
      const rows = shown.map((x) => {
        const g = `${x.bid}:${x.ti}`;
        const head = st.sort === 'bab' && g !== lastG ? `<tr class="grp"><td colspan="5"><a href="#/b/${x.bid}?t=${x.ti}">${esc(x.name)}</a> <small>${esc(x.ref)} · ${esc(x.babN)}</small></td></tr>` : '';
        lastG = g;
        const what = [x.prov, x.label && x.label !== x.prov ? x.label : '', x.col].filter(Boolean).join(' · ');
        return `${head}<tr class="k-${x.kind}">
          <td>${st.sort === 'bab' ? '' : `<a class="pb-n" href="#/b/${x.bid}?t=${x.ti}">${esc(x.name)}</a>`}<div class="pb-w">${esc(what || x.name)}${x.relabel ? ' <em class="pb-rel" title="Redaksi uraian berubah antartahun">uraian berubah</em>' : ''}</div></td>
          <td class="n" data-l="TA ${prev}">${money(x.a, x.cur)}</td>
          <td class="n" data-l="TA ${Y.y}">${money(x.b, x.cur)}</td>
          <td class="n pb-d" data-l="Selisih">${x.kind === 'baru' ? '<span class="pb-tag">Baru</span>' : x.kind === 'hapus' ? '<span class="pb-tag">Dihapus</span>' : x.diff ? `${x.diff > 0 ? '▲' : '▼'} ${fmt(Math.abs(x.diff), x.cur)}` : '–'}</td>
          <td class="n pb-p" data-l="%">${pctTxt(x.pct)}</td>
        </tr>`;
      }).join('');
      ui.$('#pbList').innerHTML = r.length
        ? `<div class="pb-meta muted small">${r.length.toLocaleString('id-ID')} angka${r.length > shown.length ? `, menampilkan ${shown.length}` : ''}</div>
          <div class="tbl-wrap pb-tw"><table class="t pb-t"><thead><tr><th>Satuan biaya</th><th class="n">TA ${prev}</th><th class="n">TA ${Y.y}</th><th class="n">Selisih</th><th class="n">%</th></tr></thead><tbody>${rows}</tbody></table></div>
          ${r.length > shown.length ? `<div class="pb-more"><button type="button" class="btn" id="pbMore">Tampilkan ${Math.min(300, r.length - shown.length)} lagi</button></div>` : ''}`
        : '<div class="empty small">Tidak ada angka yang cocok dengan saringan ini.</div>';
      const more = ui.$('#pbMore');
      if (more) more.onclick = () => { st.limit += 300; draw(); };
      ui.$$('.pb-stat').forEach((b) => b.classList.toggle('on', b.dataset.kind === st.kind));
    };
    draw();
    let tm;
    ui.$('#pbQ').oninput = (e) => { clearTimeout(tm); tm = setTimeout(() => { st.q = e.target.value; st.limit = 300; draw(); }, 180); };
    ui.$('#pbKind').onchange = (e) => { st.kind = e.target.value; st.limit = 300; save(); draw(); };
    ui.$('#pbBab').onchange = (e) => { st.bab = e.target.value; st.limit = 300; save(); draw(); };
    ui.$('#pbSort').onchange = (e) => { st.sort = e.target.value; save(); draw(); };
    ui.$$('.pb-stat').forEach((b) => b.onclick = () => { st.kind = b.dataset.kind; ui.$('#pbKind').value = st.kind; st.limit = 300; save(); draw(); });
    ui.$('#pbXls').onclick = async () => {
      const r = filtered();
      const X = await xlsx();
      const aoa = [[`Perubahan SBM TA ${prev} (${YEARS[prev].src}) ke TA ${Y.y} (${Y.src})`], [`Saringan: ${KINDS.find((k) => k[0] === st.kind)[1]}${st.bab ? ' · ' + BABS.find((b) => b.key === st.bab).name : ''}${st.q ? ' · cari "' + st.q + '"' : ''}`], [],
        ['Bab', 'Satuan biaya', `Rujukan TA ${Y.y}`, 'Provinsi', 'Uraian', 'Kolom', 'Mata uang', `TA ${prev}`, `TA ${Y.y}`, 'Selisih', 'Perubahan (%)', 'Keterangan'],
        ...r.map((x) => [x.babN, x.name, x.ref, x.prov, x.label, x.col, x.cur === 'USD' ? 'USD' : 'IDR', x.a ?? '', x.b ?? '', x.diff ?? '', x.pct != null ? Math.round(x.pct * 10) / 10 : '', { naik: 'Naik', turun: 'Turun', baru: 'Baru', hapus: 'Dihapus', tetap: 'Tetap' }[x.kind] + (x.relabel ? ' (uraian berubah)' : '')])];
      const ws = X.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [12, 40, 18, 22, 50, 18, 9, 14, 14, 14, 12, 22].map((w) => ({ wch: w }));
      numFmt(X, ws, [7, 8, 9], 4);
      ws['!autofilter'] = { ref: X.utils.encode_range({ s: { r: 3, c: 0 }, e: { r: 3 + r.length, c: 11 } }) };
      const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'Perubahan');
      download(X, wb, `Perubahan-SBM-${prev}-${Y.y}.xlsx`); ui.toast('Excel diunduh');
    };
  };
  return { html, after };
}

/* ---------------- Unduh Tabel Biaya ---------------- */
let xl = null;
async function xlsx() { if (!xl) xl = loadScript('vendor/xlsx.mini.min.js'); await xl; return window.XLSX; }
function numFmt(X, ws, cols, from) {
  const rg = X.utils.decode_range(ws['!ref']);
  for (let R = from; R <= rg.e.r; R++) for (const C of cols) { const c = ws[X.utils.encode_cell({ r: R, c: C })]; if (c && c.t === 'n') c.z = '#,##0.##'; }
}
function download(X, wb, name) {
  const out = X.write(wb, { type: 'array', bookType: 'xlsx' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
// Satu tabel SBM → baris lembar kerja (judul, sumber, header, isi). Angka jadi angka; baris kelompok tetap teks.
function sheetOf(X, bid, ti) {
  const b = S.butir[bid], t = b.tables[ti];
  const vc = valueCols(t);
  const aoa = [[tableName(bid, ti)], [`${lampRef(b)} · SBM TA ${Y.y} (${Y.src}) · ${b.sifat === 'BT' ? 'Batas tertinggi' : 'Dapat dilampaui'}`], [], t.cols.slice()];
  for (const r of t.rows) {
    if (r.g) { aoa.push([r.c || '', r.g]); continue; }
    if (!r.v) continue;
    aoa.push(r.v.map((x, i) => (vc.includes(i) && r.n?.[i] != null ? r.n[i] : x)));
  }
  aoa.push([], [`Diunduh dari cek-sbm.vercel.app (oleh @ryanepwijaya) pada ${new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}. Bukan dokumen resmi; cek ulang ke ${Y.src}.`]);
  const ws = X.utils.aoa_to_sheet(aoa);
  ws['!cols'] = t.cols.map((c, i) => ({ wch: vc.includes(i) ? 16 : i === 0 ? 10 : Math.min(60, Math.max(14, ...t.rows.filter((r) => r.v).slice(0, 60).map((r) => String(r.v[i] || '').length))) }));
  numFmt(X, ws, vc, 4);
  return ws;
}
const fileSafe = (s) => s.replace(/[^\w]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
export function viewUnduh(ui) {
  const groups = BABS.map((bab) => {
    const ids = [...new Set(bab.items.map((x) => x.butir))].filter((id) => S.butir[id]);
    return { bab, list: ids.flatMap((id) => S.butir[id].tables.map((t, ti) => ({ id, ti, n: tableName(id, ti), ref: lampRef(S.butir[id]), rows: t.rows.filter((r) => r.v).length }))) };
  }).filter((g) => g.list.length);
  const inBab = new Set(groups.flatMap((g) => g.list.map((x) => x.id)));
  const rest = Object.keys(S.butir).filter((id) => !inBab.has(id));
  if (rest.length) groups.push({ bab: { key: 'lain', name: 'Lainnya', icon: 'list' }, list: rest.flatMap((id) => S.butir[id].tables.map((t, ti) => ({ id, ti, n: tableName(id, ti), ref: lampRef(S.butir[id]), rows: t.rows.filter((r) => r.v).length }))) });
  const total = groups.reduce((a, g) => a + g.list.length, 0);
  const html = `<div class="page-head"><h1 class="title">Unduh Tabel Biaya</h1><p class="subtitle">Unduh tabel satuan biaya SBM TA ${Y.y} (${esc(Y.src)}) sebagai Excel, siap dipakai untuk RAB atau lampiran. Angka tersimpan sebagai angka, bukan teks. Ganti tahun anggaran di kiri atas untuk mengunduh tahun lain.</p></div>
  <div id="unRoot"><div class="card un-top"><div><b>${total} tabel</b> dari ${Object.keys(S.butir).length} butir · TA ${Y.y}</div>
    <label class="pb-q un-q">${ic('search')}<input id="unQ" type="search" placeholder="Saring nama tabel…" autocomplete="off"></label>
    <button type="button" class="btn primary" id="unAll">${ic('download')} Unduh semua (1 file)</button></div>
  ${groups.map((g) => `<section class="un-g" data-g="${g.bab.key}"><h2 class="sec">${ic(g.bab.icon || 'list')} ${esc(g.bab.name)} <span class="count">${g.list.length}</span></h2>
    <div class="card list un-list">${g.list.map((x) => `<div class="li un-it" data-s="${esc(norm(x.n + ' ' + x.ref + ' ' + g.bab.name))}"><span class="li-ico">${ic('file-spreadsheet')}</span><div class="grow"><a class="t" href="#/b/${x.id}?t=${x.ti}">${esc(x.n)}</a><div class="d">${esc(x.ref)} · ${x.rows} baris</div></div><button type="button" class="btn sm" data-dl="${x.id}:${x.ti}">${ic('download')} Excel</button></div>`).join('')}</div></section>`).join('')}</div>`;
  const after = () => {
    ui.$('#unRoot').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-dl]');
      if (!b) return;
      const [id, ti] = b.dataset.dl.split(':'); const t = Number(ti);
      b.disabled = true;
      try {
        const X = await xlsx();
        const wb = X.utils.book_new();
        X.utils.book_append_sheet(wb, sheetOf(X, id, t), `${id} t${t + 1}`.slice(0, 31));
        download(X, wb, `SBM-TA${Y.y}-${id}${S.butir[id].tables.length > 1 ? '-t' + (t + 1) : ''}-${fileSafe(tableName(id, t))}.xlsx`);
        ui.toast('Excel diunduh');
      } catch (err) { console.error(err); ui.toast('Gagal membuat Excel'); } finally { b.disabled = false; }
    });
    ui.$('#unAll').onclick = async (e) => {
      const btn = e.currentTarget; btn.disabled = true; const old = btn.innerHTML; btn.innerHTML = `${ic('clock')} Menyiapkan…`;
      try {
        const X = await xlsx();
        const wb = X.utils.book_new();
        const idx = [['Daftar tabel SBM TA ' + Y.y + ' (' + Y.src + ')'], [], ['Lembar', 'Bab', 'Tabel', 'Rujukan', 'Jumlah baris']];
        for (const g of groups) for (const x of g.list) {
          const nm = `${x.id} t${x.ti + 1}`;
          X.utils.book_append_sheet(wb, sheetOf(X, x.id, x.ti), nm);
          idx.push([nm, g.bab.name, x.n, x.ref, x.rows]);
        }
        const ws = X.utils.aoa_to_sheet(idx); ws['!cols'] = [{ wch: 10 }, { wch: 22 }, { wch: 60 }, { wch: 20 }, { wch: 12 }];
        X.utils.book_append_sheet(wb, ws, 'Daftar');
        wb.SheetNames.unshift(wb.SheetNames.pop());
        download(X, wb, `SBM-TA${Y.y}-semua-tabel.xlsx`); ui.toast('Excel diunduh');
      } catch (err) { console.error(err); ui.toast('Gagal membuat Excel'); } finally { btn.disabled = false; btn.innerHTML = old; }
    };
    ui.$('#unQ').oninput = (e) => {
      const q = norm(e.target.value).split(' ').filter(Boolean);
      ui.$$('.un-it').forEach((it) => { it.hidden = !q.every((t) => it.dataset.s.includes(t)); });
      ui.$$('.un-g').forEach((g) => { g.hidden = !g.querySelector('.un-it:not([hidden])'); });
    };
  };
  return { html, after };
}
