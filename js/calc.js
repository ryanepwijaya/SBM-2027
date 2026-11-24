// Kalkulator melayang: tombol di pojok kanan bawah, panel yang bisa digeser, dan pil saat diminimalkan.
// Dipasang di <body> (di luar area halaman) sehingga tetap ada saat pindah menu dan tidak ikut di-scroll.
// Tidak menyimpan apa pun ke perangkat: muat ulang = kosong.
// "Ambil angka": klik angka mana pun di halaman untuk memasukkannya; klik berikutnya otomatis dijumlahkan.
import { ic } from './icons.js';

const OPS = ['+', '−', '×', '÷'];
const KEYS = ['C', '⌫', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '00', '0', ',', '='];
const S = { mode: 'fab', tok: [], fresh: false, last: null, corner: 'br', pick: false, paste: false };
let el = {};

/* ---------- angka ---------- */
// Teks angka format Indonesia ("1.060.000,5") → Number
const toNum = (s) => Number(String(s).replace(/\./g, '').replace(',', '.'));
// Number → teks Indonesia, maksimal 2 desimal
export function fmtNum(n) {
  if (!Number.isFinite(n)) return 'Error';
  const r = Math.round(n * 100) / 100;
  return r.toLocaleString('id-ID', { maximumFractionDigits: 2 }).replace('-', '−');
}
// Angka yang sedang diketik: ribuan diberi titik, desimal dibiarkan apa adanya
function fmtTyped(s) {
  const neg = s.startsWith('-');
  const [a, b] = (neg ? s.slice(1) : s).split(',');
  const int = (a || '0').replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (neg ? '−' : '') + int + (b !== undefined ? ',' + b : '');
}
const isNum = (t) => t !== undefined && !OPS.includes(t) && t !== '%';

// Hitung token: × ÷ didahulukan; "a + b%" = a + a×b/100, selain itu b% = b/100
function evaluate(tok) {
  const t = tok.slice();
  while (t.length && (OPS.includes(t[t.length - 1]) || t[t.length - 1] === '-')) t.pop();
  if (!t.length) return null;
  let sum = 0, term = null, sign = 1, mulOp = null;
  const flush = () => { if (term !== null) sum += sign * term; term = null; mulOp = null; };
  for (let i = 0; i < t.length; i++) {
    const x = t[i];
    if (x === '+' || x === '−') { flush(); sign = x === '+' ? 1 : -1; continue; }
    if (x === '×' || x === '÷') { mulOp = x; continue; }
    if (x === '%') continue;
    let v = toNum(x);
    if (t[i + 1] === '%') v = term === null && i > 0 ? sum * v / 100 : v / 100;
    if (term === null) term = v;
    else term = mulOp === '÷' ? (v === 0 ? NaN : term / v) : term * v;
  }
  flush();
  return sum;
}

/* ---------- input ---------- */
function press(k) {
  const t = S.tok, end = t[t.length - 1];
  if (k === 'C') { S.tok = []; S.last = null; S.fresh = false; return draw(); }
  if (k === '⌫') {
    if (S.fresh) { S.tok = []; S.fresh = false; return draw(); }
    if (isNum(end)) { const s = end.slice(0, -1); if (s && s !== '-') t[t.length - 1] = s; else t.pop(); } else t.pop();
    return draw();
  }
  if (k === '=') {
    const v = evaluate(t);
    if (v === null) return;
    S.last = v; S.tok = Number.isFinite(v) ? [numTok(v)] : []; S.fresh = true;
    return draw();
  }
  if (OPS.includes(k)) {
    S.fresh = false;
    if (!t.length) { if (S.last !== null && Number.isFinite(S.last)) t.push(numTok(S.last)); else if (k === '−') { t.push('-'); return draw(); } else return; }
    if (OPS.includes(end)) t[t.length - 1] = k; else if (end === '-') return; else t.push(k);
    return draw();
  }
  if (k === '%') { if (isNum(end) && end !== '-') { t.push('%'); S.fresh = false; } return draw(); }
  // angka, 00, koma
  if (S.fresh) { S.tok = []; S.fresh = false; return press(k); }
  if (end === '%') t.push('×');
  if (!isNum(t[t.length - 1])) t.push(k === ',' ? '0,' : (k === '00' ? '0' : k));
  else {
    let s = t[t.length - 1];
    if (k === ',') { if (!s.includes(',')) s += s === '-' ? '0,' : ','; }
    else if (s.replace(/[^\d]/g, '').length < 15) s = (s === '0' ? '' : s === '-0' ? '-' : s) + k;
    t[t.length - 1] = s;
  }
  draw();
}
const numTok = (v) => { const r = Math.round(v * 100) / 100; return String(r).replace('.', ','); };
// Masukkan angka dari halaman: kalau sebelumnya angka, otomatis "+"
function insert(v) {
  if (S.fresh) { S.fresh = false; }
  const t = S.tok, end = t[t.length - 1];
  if (end === '%') t.push('+');
  else if (end === '-') t.pop();
  else if (isNum(end)) t.push('+');
  if (end === '-') v = -v;
  t.push(numTok(v));
  draw();
}

/* ---------- tampilan ---------- */
function exprText() { return S.tok.map((x) => (isNum(x) ? fmtTyped(x) : x === '%' ? '%' : ` ${x} `)).join('').replace(/ %/g, '%').trim(); }
function resultText() {
  const v = S.tok.length ? evaluate(S.tok) : S.last;
  return v === null ? '0' : fmtNum(v);
}
function draw() {
  if (!el.root) return;
  el.root.dataset.mode = S.mode;
  el.root.dataset.corner = S.corner;
  el.ex.textContent = S.fresh ? '' : exprText();
  const r = resultText();
  el.rs.textContent = r;
  el.pv.textContent = r;
  el.pick.classList.toggle('on', S.pick);
  el.pick.setAttribute('aria-pressed', S.pick ? 'true' : 'false');
  el.paste.classList.toggle('on', S.paste);
  el.paste.setAttribute('aria-pressed', S.paste ? 'true' : 'false');
  if (!flashT) { el.hint.textContent = hintText(); el.hint.hidden = !(S.pick || S.paste); }
  document.body.classList.toggle('calc-picking', S.pick);
  document.body.classList.toggle('calc-pasting', S.paste);
  if (!S.pick && !S.paste) el.mark.style.display = 'none';
  place();
}

/* ---------- posisi ---------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// Tombol dan pil diangkat bila ada bilah tombol lengket di bawah (mis. "Cek estimasi") supaya tidak menutupi
function lift() {
  const bars = document.querySelectorAll('.wz-bar');
  const vh = window.innerHeight;
  let need = 0;
  bars.forEach((b) => {
    if (!b.offsetParent) return;
    const r = b.getBoundingClientRect();
    if (r.bottom > vh - 200 && r.top < vh) need = Math.max(need, vh - r.top + 10);
  });
  return need;
}
function place() {
  if (!el.root) return;
  const up = lift();
  el.root.style.setProperty('--calc-lift', up ? up + 'px' : 'var(--calc-base)');
}
let raf = 0;
const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; place(); }); };

function setMode(m) {
  S.mode = m;
  if (m !== 'open') { S.pick = false; S.paste = false; }
  draw();
  if (m === 'open') el.panel.focus({ preventScroll: true });
  if (m === 'fab') el.fab.focus({ preventScroll: true });
  if (m === 'min') el.pill.focus({ preventScroll: true });
}

/* ---------- ambil angka dari halaman ---------- */
// Prefiks Rp / US$ ikut disorot tetapi tidak ikut dihitung
const NUM_RE = /(?:Rp\s?|US\$\s?)?(?:[−-]?\d{1,3}(?:\.\d{3})+(?:,\d+)?|[−-]?\d+(?:,\d+)?)/g;
const stripCur = (s) => s.replace(/^(?:Rp|US\$)\s?/, '');
function caretAt(x, y) {
  if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(x, y); return r && { node: r.startContainer, off: r.startOffset }; }
  if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(x, y); return p && { node: p.offsetNode, off: p.offset }; }
  return null;
}
// Cari angka di bawah titik (x, y): { v, range } atau null.
// Teks di elemen yang diklik dipindai per angka, lalu dipilih angka yang kotaknya memuat titik klik.
function tokenHit(node, x, y) {
  const txt = node.nodeValue;
  for (const m of txt.matchAll(NUM_RE)) {
    let a = m.index, s = m[0];
    // tanda minus hanya bila berdiri sendiri (bukan "L1-25")
    if (/^[−-]/.test(s) && a > 0 && /[\w)]/.test(txt[a - 1])) { a += 1; s = s.slice(1); }
    const range = document.createRange(); range.setStart(node, a); range.setEnd(node, a + s.length);
    s = stripCur(s);
    for (const r of range.getClientRects()) {
      if (x >= r.left - 3 && x <= r.right + 3 && y >= r.top - 3 && y <= r.bottom + 3) return { v: toNum(s.replace('−', '-')), range };
    }
  }
  return null;
}
function numberAt(x, y, target) {
  if (target && target.matches && target.matches('input, textarea')) {
    const m = (target.value || '').trim().match(NUM_RE);
    return m && m.length === 1 ? { v: toNum(stripCur(m[0]).replace('−', '-')), el: target } : null;
  }
  const c = caretAt(x, y);
  if (c && c.node && c.node.nodeType === 3 && (!target || target.contains(c.node))) { const h = tokenHit(c.node, x, y); if (h) return h; }
  if (!target || target.nodeType !== 1) return null;
  const tw = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
  let n = 0;
  for (let t = tw.nextNode(); t && n < 300; t = tw.nextNode(), n++) { if (/\d/.test(t.nodeValue)) { const h = tokenHit(t, x, y); if (h) return h; } }
  return null;
}
const inCalc = (t) => t && t.closest && t.closest('.calc-root');
// Kotak isian yang bisa ditempeli hasil
const pasteTarget = (t) => {
  const inp = t && t.closest && t.closest('input, textarea');
  if (!inp || inCalc(inp)) return null;
  if (inp.tagName === 'INPUT' && !/^(text|number|search|tel|)$/.test(inp.type)) return null;
  return inp;
};
const markBox = (r) => Object.assign(el.mark.style, { display: 'block', left: r.left - 3 + 'px', top: r.top - 2 + 'px', width: r.width + 6 + 'px', height: r.height + 4 + 'px' });
function onPickMove(e) {
  if ((!S.pick && !S.paste) || inCalc(e.target)) { el.mark.style.display = 'none'; return; }
  if (S.paste) {
    const inp = pasteTarget(e.target);
    if (!inp || inp.readOnly || inp.disabled) { el.mark.style.display = 'none'; return; }
    markBox(inp.getBoundingClientRect()); return;
  }
  const hit = numberAt(e.clientX, e.clientY, e.target);
  if (!hit) { el.mark.style.display = 'none'; return; }
  markBox(hit.range ? hit.range.getBoundingClientRect() : hit.el.getBoundingClientRect());
}
function current() { const v = S.tok.length ? evaluate(S.tok) : S.last; return v === null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100; }
function onPickClick(e) {
  if ((!S.pick && !S.paste) || inCalc(e.target)) return;
  e.preventDefault(); e.stopPropagation();
  if (S.paste) {
    const inp = pasteTarget(e.target);
    if (!inp) { flash('Klik kotak isian untuk menempel.'); return; }
    if (inp.readOnly || inp.disabled) { flash('Kotak ini terkunci, tidak bisa diisi.'); return; }
    const v = current();
    if (v === null) { flash('Belum ada hasil untuk ditempel.'); return; }
    inp.value = inp.type === 'number' ? String(v) : String(v).replace('.', ',');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    inp.focus({ preventScroll: true });
    S.paste = false; draw();
    flash(`Ditempel: ${fmtNum(v)}`);
    return;
  }
  const hit = numberAt(e.clientX, e.clientY, e.target);
  if (!hit || !Number.isFinite(hit.v)) { flash('Bukan angka. Klik tepat di angkanya.'); return; }
  insert(hit.v);
  flash(`+ ${fmtNum(hit.v)}`);
}
let flashT = 0;
function flash(msg) {
  el.hint.textContent = msg; el.hint.hidden = false;
  clearTimeout(flashT);
  flashT = setTimeout(() => { flashT = 0; el.hint.textContent = hintText(); el.hint.hidden = !(S.pick || S.paste); }, 1300);
}
const HINT = 'Klik angka di halaman. Klik lagi untuk menjumlahkan. Esc untuk selesai.';
const HINT_PASTE = 'Klik kotak isian di halaman untuk menempelkan hasil. Esc untuk batal.';
const hintText = () => (S.paste ? HINT_PASTE : HINT);

/* ---------- geser: bebas saat ditarik, lalu menempel ke pojok terdekat ---------- */
// Pojok: br (kanan bawah, bawaan), bl, tr, tl. Berlaku untuk tombol, pil, dan panel.
function snapTo(node, corner) {
  const before = node.getBoundingClientRect();
  node.style.left = node.style.top = node.style.right = node.style.bottom = '';
  S.corner = corner; el.root.dataset.corner = corner;
  const after = node.getBoundingClientRect();
  node.style.transition = 'none';
  node.style.transform = `translate(${before.left - after.left}px, ${before.top - after.top}px)`;
  node.getBoundingClientRect();
  node.style.transition = 'transform .22s cubic-bezier(.22, 1, .36, 1)';
  node.style.transform = '';
  setTimeout(() => { node.style.transition = ''; }, 260);
}
// handle = bagian yang ditarik; node = elemen yang berpindah; onTap = aksi bila hanya diketuk
function draggable(handle, node, onTap) {
  let st = null;
  handle.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || (handle === el.head && e.target.closest('button'))) return;
    if (handle !== el.head) e.preventDefault(); // cegah seret teks/gambar bawaan browser yang membatalkan geseran
    const r = node.getBoundingClientRect();
    st = { id: e.pointerId, sx: e.clientX, sy: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, h: r.height, moved: false };
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointermove', (e) => {
    if (!st || e.pointerId !== st.id) return;
    if (!st.moved && Math.hypot(e.clientX - st.sx, e.clientY - st.sy) < 6) return;
    if (!st.moved) { st.moved = true; node.classList.add('drag'); el.root.classList.add('dragging'); }
    const x = clamp(e.clientX - st.dx, 4, window.innerWidth - st.w - 4);
    const y = clamp(e.clientY - st.dy, 4, window.innerHeight - st.h - 4);
    Object.assign(node.style, { left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto' });
  });
  const end = (e) => {
    if (!st || e.pointerId !== st.id) return;
    const moved = st.moved; st = null;
    node.classList.remove('drag'); el.root.classList.remove('dragging');
    if (!moved) { if (e.type === 'pointerup' && onTap) onTap(); return; }
    const r = node.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    snapTo(node, (cy < window.innerHeight / 2 ? 't' : 'b') + (cx < window.innerWidth / 2 ? 'l' : 'r'));
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}
function initDrag() {
  draggable(el.head, el.panel, null);
  draggable(el.fab, el.fab, () => setMode('open'));
  draggable(el.pill, el.pill, () => setMode('open'));
}

/* ---------- keyboard (hanya saat fokus di panel) ---------- */
const KEYMAP = { '*': '×', x: '×', X: '×', '/': '÷', '-': '−', '+': '+', '%': '%', ',': ',', '.': ',', Enter: '=', '=': '=', Backspace: '⌫', Delete: 'C' };
function onKey(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  e.stopPropagation(); // jangan sampai "/" membuka pencarian atau pintasan lain milik halaman
  if (e.key === 'Escape') { e.preventDefault(); if (S.pick || S.paste) { S.pick = false; S.paste = false; draw(); } else setMode('min'); return; }
  const k = /^\d$/.test(e.key) ? e.key : KEYMAP[e.key];
  if (!k) return;
  e.preventDefault();
  press(k);
  const b = el.keys.querySelector(`[data-k="${k}"]`);
  if (b) { b.classList.add('hit'); setTimeout(() => b.classList.remove('hit'), 120); }
}

/* ---------- salin ---------- */
async function copy() {
  const v = S.tok.length ? evaluate(S.tok) : S.last;
  if (v === null || !Number.isFinite(v)) return;
  const txt = String(Math.round(v * 100) / 100).replace('.', ',');
  try { await navigator.clipboard.writeText(txt); } catch {
    const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch { /* abaikan */ } ta.remove();
  }
  el.copy.innerHTML = `${ic('check')}<span>Tersalin</span>`;
  setTimeout(() => { el.copy.innerHTML = `${ic('copy')}<span>Salin</span>`; }, 1200);
}

export function initCalc() {
  const root = document.createElement('div');
  root.className = 'calc-root';
  root.dataset.mode = 'fab';
  root.innerHTML = `
    <button type="button" class="calc-fab" aria-label="Buka kalkulator" title="Kalkulator · tarik untuk pindah pojok">${ic('calculator')}</button>
    <button type="button" class="calc-pill" aria-label="Buka kalkulator">${ic('calculator')}<span>=</span><b class="calc-pv">0</b>${ic('chevron-up')}</button>
    <div class="calc-panel" role="dialog" aria-label="Kalkulator" tabindex="-1">
      <div class="calc-head" title="Tarik ke salah satu pojok layar">${ic('grip-horizontal')}<span>Kalkulator</span>
        <button type="button" class="calc-hb" data-a="min" aria-label="Minimalkan" title="Minimalkan">${ic('minus')}</button>
        <button type="button" class="calc-hb" data-a="close" aria-label="Tutup" title="Tutup">${ic('x')}</button>
      </div>
      <div class="calc-screen"><div class="calc-ex" aria-hidden="true"></div><div class="calc-rs" aria-live="polite">0</div></div>
      <div class="calc-tools">
        <button type="button" class="calc-pick" aria-pressed="false" title="Ambil angka: klik angka di halaman untuk dimasukkan">${ic('mouse-pointer-click')}<span>Ambil</span></button>
        <button type="button" class="calc-paste" aria-pressed="false" title="Tempel: klik kotak isian di halaman untuk mengisi dengan hasil">${ic('clipboard-paste')}<span>Tempel</span></button>
        <button type="button" class="calc-copy" title="Salin hasil tanpa titik ribuan">${ic('copy')}<span>Salin</span></button>
      </div>
      <div class="calc-hint" hidden>${HINT}</div>
      <div class="calc-keys">${KEYS.map((k) => `<button type="button" data-k="${k}" class="${OPS.includes(k) || k === '%' ? 'op' : ''}${k === '=' ? ' eq' : ''}${k === 'C' || k === '⌫' ? ' fn' : ''}" aria-label="${{ '⌫': 'Hapus satu', C: 'Bersihkan', '×': 'Kali', '÷': 'Bagi', '−': 'Kurang', '+': 'Tambah', '=': 'Sama dengan', '%': 'Persen', ',': 'Koma' }[k] || k}">${k === '⌫' ? ic('delete') : k}</button>`).join('')}</div>
    </div>
    <div class="calc-mark" aria-hidden="true"></div>`;
  document.body.appendChild(root);
  const q = (s) => root.querySelector(s);
  el = { root, fab: q('.calc-fab'), pill: q('.calc-pill'), pv: q('.calc-pv'), panel: q('.calc-panel'), head: q('.calc-head'), ex: q('.calc-ex'), rs: q('.calc-rs'), pick: q('.calc-pick'), paste: q('.calc-paste'), copy: q('.calc-copy'), hint: q('.calc-hint'), keys: q('.calc-keys'), mark: q('.calc-mark') };
  // tombol & pil: ketuk = buka, tarik = pindah pojok (lihat draggable); Enter/Spasi lewat keyboard tetap membuka
  [el.fab, el.pill].forEach((b) => b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMode('open'); } }));
  root.querySelectorAll('.calc-hb').forEach((b) => { b.onclick = () => setMode(b.dataset.a === 'min' ? 'min' : 'fab'); });
  el.keys.addEventListener('click', (e) => { const b = e.target.closest('button[data-k]'); if (b) { press(b.dataset.k); el.panel.focus({ preventScroll: true }); } });
  const clearFlash = () => { clearTimeout(flashT); flashT = 0; };
  el.pick.onclick = () => { clearFlash(); S.pick = !S.pick; S.paste = false; draw(); el.panel.focus({ preventScroll: true }); };
  el.paste.onclick = () => {
    if (!S.paste && current() === null) { flash('Belum ada hasil untuk ditempel.'); return; }
    clearFlash(); S.paste = !S.paste; S.pick = false; draw(); el.panel.focus({ preventScroll: true });
  };
  el.copy.onclick = copy;
  el.panel.addEventListener('keydown', onKey);
  initDrag();
  document.addEventListener('click', onPickClick, true);
  document.addEventListener('pointermove', onPickMove, { passive: true });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && (S.pick || S.paste) && !el.panel.contains(document.activeElement)) { S.pick = false; S.paste = false; draw(); } });
  window.addEventListener('scroll', () => { el.mark.style.display = 'none'; schedule(); }, { passive: true });
  window.addEventListener('resize', () => place());
  window.addEventListener('hashchange', () => setTimeout(place, 60));
  new MutationObserver(schedule).observe(document.getElementById('main') || document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-wz'] });
  draw();
}
