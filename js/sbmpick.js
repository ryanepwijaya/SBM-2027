// Pencarian satuan biaya SBM untuk alat hitung (Honorarium, Invoice): kotak isian dengan saran kata kunci.
// Setiap angka di tabel SBM (baris × kolom nilai) jadi satu pilihan; hanya rupiah.
import { S, esc, fmt, norm, valueCols, shortCol, unitCol, UNIT } from './store.js';
import { ENTRIES, SIFAT } from './catalog.js';
import { babOfButir } from './bab.js';

let IDX = null;
const isNumCell = (s) => /^(Rp|\$|US\$)?\s?[\d.,]+$/.test(String(s).trim());
function build() {
  const L = [];
  for (const b of Object.values(S.butir)) {
    const bab = babOfButir(b.id)?.key || '';
    b.tables.forEach((t, ti) => {
      const ent = ENTRIES.find((e) => e.butir === b.id && e.table === ti) || ENTRIES.find((e) => e.butir === b.id);
      const name = ent ? ent.name : b.title;
      const vcols = valueCols(t);
      const uc = unitCol(t);
      const syn = ent?.syn ? ent.syn.join(' ') : '';
      const groups = [];
      for (const r of t.rows) {
        if (r.g) {
          const depth = String(r.c || '').split('.').length;
          groups.length = Math.max(0, Math.min(groups.length, depth - 2));
          groups.push(r.g);
          continue;
        }
        if (!r.n || !r.v) continue;
        if ((r.cu || t.cur) === 'USD') continue;
        const texts = r.v.filter((x, i) => i > 0 && !vcols.includes(i) && i !== uc?.i && x && !isNumCell(x));
        const unitRaw = uc ? r.v[uc.i] : '';
        const unit = UNIT[unitRaw] || unitRaw || '';
        for (const ci of vcols) {
          const n = r.n[ci];
          if (n == null) continue;
          const col = vcols.length > 1 ? shortCol(t.cols[ci]) : '';
          const row = [...groups.slice(-1), ...texts].filter(Boolean).join(' · ');
          L.push({
            id: `${b.id}:${ti}:${r.c}:${ci}`, bid: b.id, ti, n, unit, sifat: b.sifat, bab,
            t: [name, row, col].filter(Boolean).join(' · '),
            sub: `${b.lamp === 1 ? 'Lamp. I' : 'Lamp. II'} angka ${r.v[0] || b.no}`,
            s: norm(`${name} ${syn} ${groups.join(' ')} ${texts.join(' ')} ${col}`),
          });
        }
      }
    });
  }
  IDX = L;
}
export function sbmSuggest(q, prefer = '', limit = 8) {
  if (!IDX) build();
  const n = norm(q);
  if (!n) return [];
  const toks = n.split(' ').filter(Boolean);
  const out = [];
  for (const it of IDX) {
    const words = it.s.split(' ');
    let score = 0;
    let ok = true;
    for (const t of toks) {
      if (words.includes(t)) score -= 2;
      else if (words.some((w) => w.startsWith(t))) score -= 1;
      else { ok = false; break; }
    }
    if (!ok) continue;
    if (prefer && it.bab === prefer) score -= 3;
    out.push({ it, score });
  }
  out.sort((a, b) => a.score - b.score || a.it.t.length - b.it.t.length);
  return out.slice(0, limit).map((x) => x.it);
}
export const sbmById = (id) => { if (!IDX) build(); return IDX.find((x) => x.id === id) || null; };
export const sifatTxt = (s) => SIFAT[s]?.label || '';

// Kotak saran mengambang yang dipakai bersama. Dipasang pada wadah (delegasi) agar baris yang digambar ulang tetap bekerja.
// opt: { selector, prefer, onPick(input, item) }. Tab/Enter memilih saran yang disorot; Esc menutup.
export function attachSbmPicker(root, opt) {
  let pop = document.getElementById('sbmPop');
  if (!pop) { pop = document.createElement('div'); pop.id = 'sbmPop'; pop.className = 'sbm-pop'; pop.setAttribute('role', 'listbox'); pop.hidden = true; document.body.appendChild(pop); }
  let cur = null, items = [], idx = 0;
  const place = () => {
    if (!cur) return;
    const r = cur.getBoundingClientRect();
    const w = Math.max(r.width, Math.min(520, window.innerWidth - 16));
    pop.style.width = w + 'px';
    pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + 'px';
    const below = window.innerHeight - r.bottom;
    if (below < 260 && r.top > below) { pop.style.top = ''; pop.style.bottom = (window.innerHeight - r.top + 4) + 'px'; }
    else { pop.style.bottom = ''; pop.style.top = (r.bottom + 4) + 'px'; }
  };
  const close = () => { pop.hidden = true; items = []; };
  const render = () => {
    if (!cur || !cur.value.trim()) { close(); return; }
    if (!items.length) { pop.innerHTML = '<div class="sbm-empty">Tidak ada satuan biaya yang cocok. Coba kata lain, atau ketik tarif bebas.</div>'; pop.hidden = false; place(); return; }
    pop.innerHTML = items.map((it, i) => `<button type="button" class="sbm-it${i === idx ? ' on' : ''}" data-i="${i}" tabindex="-1"><span class="sbm-t"><b>${esc(it.t)}</b><small>${esc(it.sub)}</small></span><span class="sbm-v"><b>${fmt(it.n)}</b>${it.unit ? `<small>/${esc(it.unit)}</small>` : ''}<em class="chip ${SIFAT[it.sifat]?.cls || ''}">${esc(sifatTxt(it.sifat))}</em></span></button>`).join('');
    pop.hidden = false; place();
    pop.querySelector('.sbm-it.on')?.scrollIntoView({ block: 'nearest' });
  };
  const pick = (it, how) => { const inp = cur; close(); opt.onPick(inp, it, how); };
  root.addEventListener('input', (e) => {
    const inp = e.target.closest(opt.selector);
    if (!inp) return;
    cur = inp; items = sbmSuggest(inp.value, opt.prefer); idx = 0; render();
  });
  root.addEventListener('keydown', (e) => {
    const inp = e.target.closest(opt.selector);
    if (!inp || pop.hidden || cur !== inp) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); e._sbm = true; idx = Math.min(items.length - 1, idx + 1); render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); e._sbm = true; idx = Math.max(0, idx - 1); render(); }
    else if ((e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) && items[idx]) { if (e.key === 'Enter') e.preventDefault(); e._sbm = true; pick(items[idx], e.key === 'Enter' ? 'enter' : 'tab'); }
    else if (e.key === 'Escape') { e._sbm = true; close(); }
  });
  root.addEventListener('focusout', (e) => { if (e.target.closest(opt.selector)) setTimeout(() => { if (document.activeElement !== cur) close(); }, 120); });
  pop.onmousedown = (e) => e.preventDefault();
  pop.onclick = (e) => { const b = e.target.closest('[data-i]'); if (b && items[Number(b.dataset.i)]) pick(items[Number(b.dataset.i)], 'click'); };
  if (!window._sbmPopWired) {
    window._sbmPopWired = true;
    window.addEventListener('scroll', () => { if (!pop.hidden) close(); }, true);
    window.addEventListener('resize', () => { if (!pop.hidden) close(); });
    window.addEventListener('hashchange', () => { pop.hidden = true; });
  }
}
