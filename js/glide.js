// Penanda pilihan aktif yang bergeser halus pada grup pilihan (.kp-seg, .seg).
// Satu lapisan ::before mengikuti tombol .on; posisinya diatur lewat variabel CSS.
// Bila grup digambar ulang (mis. seluruh formulir dirender lagi), posisi lama diingat
// per label tombol, sehingga penanda tetap bergeser dari tempat sebelumnya.
const SEL = '.kp-seg, .seg, .tabs';
const last = new Map();
const keyOf = (seg) => [...seg.children].map((b) => b.textContent.trim()).join('|');
const reduce = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function geo(seg) {
  const on = seg.querySelector(':scope > .on');
  if (!on || !on.offsetWidth) return null;
  return { x: on.offsetLeft, y: on.offsetTop, w: on.offsetWidth, h: on.offsetHeight };
}
function put(seg, g) {
  seg.style.setProperty('--gx', g.x + 'px');
  seg.style.setProperty('--gy', g.y + 'px');
  seg.style.setProperty('--gw', g.w + 'px');
  seg.style.setProperty('--gh', g.h + 'px');
}
function still(seg, fn) {
  seg.classList.add('g-still');
  fn();
  void seg.offsetWidth;
  seg.classList.remove('g-still');
}
// fresh: grup baru masuk DOM; selain itu: tombol .on berganti
function place(seg, fresh) {
  const g = geo(seg);
  if (!g) { seg.classList.remove('glide'); return; }
  const k = keyOf(seg);
  const prev = last.get(k);
  last.set(k, g);
  if (fresh || !seg.classList.contains('glide')) {
    if (prev && !reduce() && (prev.x !== g.x || prev.y !== g.y || prev.w !== g.w)) {
      still(seg, () => { put(seg, prev); seg.classList.add('glide'); });
      requestAnimationFrame(() => put(seg, g));
    } else still(seg, () => { put(seg, g); seg.classList.add('glide'); });
    return;
  }
  put(seg, g);
}

export function initGlide() {
  // Diproses langsung di callback MutationObserver (microtask, sebelum layar digambar), bukan di frame berikutnya:
  // bila ditunda, grup yang baru dirender sempat tampil sekali dengan sorotan bawaan di posisi akhir,
  // lalu melompat ke posisi lama dan bergeser lagi, sehingga terlihat tersendat.
  const mo = new MutationObserver((muts) => {
    const todo = new Map();
    const add = (s, fresh) => todo.set(s, (todo.get(s) || false) || fresh);
    for (const m of muts) {
      if (m.type === 'attributes') {
        const p = m.target.parentElement;
        if (p && p.matches(SEL) && m.target.matches('button, a')) add(p, false);
        continue;
      }
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.matches(SEL)) add(n, true);
        n.querySelectorAll?.(SEL).forEach((s) => add(s, true));
      }
    }
    for (const [s, f] of todo) if (s.isConnected) place(s, f);
  });
  mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  document.querySelectorAll(SEL).forEach((s) => place(s, true));
  let t = 0;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => document.querySelectorAll(SEL).forEach((s) => { const g = geo(s); if (g) still(s, () => put(s, g)); }), 120); });
}
