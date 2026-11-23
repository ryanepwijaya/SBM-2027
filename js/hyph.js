// Pemenggalan kata bahasa Indonesia untuk paragraf rata kiri-kanan.
// Peramban belum punya kamus pemenggalan bahasa Indonesia, jadi tanpa ini paragraf rata kiri-kanan
// di layar sempit memunculkan celah lebar. Di sini disisipkan tanda pisah lunak (U+00AD) pada batas suku kata
// (pola KBBI: V-KV, VK-KV, VK-KKV, V-V; ng/ny/kh/sy dihitung satu konsonan; ai/au/oi/ei satu vokal).
// Tanda pisah lunak tidak terlihat dan hanya muncul di ujung baris bila kata benar-benar dipenggal.

export const PROSE = [
  '.reg p', '.reg li', '.reg > .muted', '.def', '.points li', '.disc-list li', '.callout > div',
  '.kp-foot', '.kp-note', '.qt-note', '.tx-foot', '.pb-foot', '.tx-d', '.pd-it > span',
  '.uj-mb p', '.uj-mb li', '.tip-body', '.eff-note > div', '.foot-disc', '.ms-card > .muted.small',
  '.kp-sah p', '.uj-k span',
].join(',');

const SHY = '\u00AD', ZW = '\u200B';
const INVIS = /[\u00AD\u200B]/g;
const V = /[aeiou]/;
const DIGRAPH = new Set(['ng', 'ny', 'kh', 'sy']);
const DIPH = new Set(['ai', 'au', 'oi', 'ei']);
const MINL = 2, MINR = 3; // minimal huruf di kiri dan kanan pemenggalan (ke-, di-, -kan)

function units(w) {
  const lo = w.toLowerCase(), out = [];
  for (let i = 0; i < lo.length;) {
    const two = lo.slice(i, i + 2);
    const isV = V.test(lo[i]);
    // diftong hanya bila tidak diikuti vokal (mis. "ma-in" tidak, "pan-tai" ya) — cukup diperiksa huruf sesudahnya
    if (isV && DIPH.has(two) && !V.test(lo[i + 2] || '')) { out.push({ s: w.slice(i, i + 2), v: true }); i += 2; continue; }
    if (!isV && DIGRAPH.has(two)) { out.push({ s: w.slice(i, i + 2), v: false }); i += 2; continue; }
    out.push({ s: w[i], v: isV }); i += 1;
  }
  return out;
}

export function hyphenateWord(word) {
  const w = word.replace(/\u00AD/g, '');
  if (w.length < 8 || w === w.toUpperCase()) return w; // pendek atau singkatan (PMK, SBM)
  const u = units(w);
  const cut = new Set(); // indeks unit tempat suku baru dimulai
  let i = 0;
  while (i < u.length && !u[i].v) i++;
  while (i < u.length) {
    // i = vokal; cari vokal berikutnya
    let j = i + 1;
    while (j < u.length && !u[j].v) j++;
    if (j >= u.length) break;
    const k = j - i - 1; // jumlah konsonan di antara dua vokal
    if (k === 0) cut.add(j);          // V-V
    else if (k === 1) cut.add(i + 1); // V-KV
    else cut.add(i + 2);              // VK-KV, VK-KKV
    i = j;
  }
  let res = '', pos = 0;
  u.forEach((x, n) => {
    if (cut.has(n) && pos >= MINL && w.length - pos >= MINR) res += SHY;
    res += x.s; pos += x.s.length;
  });
  return res;
}

const WORD = /[A-Za-z\u00AD]{8,}/g;
function hyphText(node) {
  const t = node.nodeValue;
  if (!t || t.length < 8) return;
  // garis miring di antara kata (ASN/Prajurit, dan/atau) diberi titik putus tak terlihat agar baris tidak renggang
  const nt = t.replace(WORD, hyphenateWord).replace(/([A-Za-z\u00AD)])\/(?=[A-Za-z(])/g, '$1/' + ZW);
  if (nt !== t) node.nodeValue = nt;
}

const SKIP = 'a[href^="http"], code, kbd, input, textarea, script, style';
function hyphEl(el) {
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement && n.parentElement.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = tw.nextNode(); n; n = tw.nextNode()) hyphText(n);
}

function scan(root) {
  if (root.nodeType === 3) { const p = root.parentElement; if (p && p.closest(PROSE)) hyphText(root); return; }
  if (root.nodeType !== 1) return;
  if (root.matches(PROSE) || root.closest(PROSE)) { hyphEl(root); return; }
  root.querySelectorAll(PROSE).forEach(hyphEl);
}

export function initHyph() {
  scan(document.body);
  new MutationObserver((list) => {
    for (const m of list) m.addedNodes.forEach(scan);
  }).observe(document.body, { childList: true, subtree: true });
  // Saat menyalin teks, buang tanda pisah lunak supaya tidak ikut ke dokumen lain
  document.addEventListener('copy', (e) => {
    const sel = String(window.getSelection() || '');
    if (!/[\u00AD\u200B]/.test(sel) || !e.clipboardData) return;
    e.clipboardData.setData('text/plain', sel.replace(INVIS, ''));
    e.preventDefault();
  });
}
