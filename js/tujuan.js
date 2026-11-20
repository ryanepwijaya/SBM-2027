// Perjadin (banyak tujuan): satu surat tugas, rute berantai asal → T1 → T2 → T3 → asal (paling banyak 3 tujuan).
// Tiap ruas dihitung dengan mesin SBM Perjalanan (taksi, tiket, transport darat), tiap tujuan dengan uang harian,
// penginapan, dan representasi provinsinya. Hanya angka SBM × volume; aturan PMK Perjalanan Dinas tidak diterapkan.
import { S, Y, esc, fmt, store, tip, valueCols } from './store.js';
import { resolve, computeRoute, rowBy, placeLabel } from './rute.js';
import { ic } from './icons.js';
import { TINGKAT, plain, adder, finish, peopleOf, resTable, buildPdf, autoMalam } from './hitung.js';

export const MAX_TUJUAN = 3;
const KEY = 'tujuan';
const DEF = () => ({
  asal: 'jakarta', dest: [{ id: '', h: 1, m: 1, mm: false }], tiket: 'half', jenis: 'lk',
  org: { pn: 0, e1: 0, pnl: 0, e2: 0, e3: 0, e4: 1 }, kelas: { pn: 'eko', e1: 'eko', pnl: 'eko', e2: 'eko', e3: 'eko', e4: 'eko' },
});
function load() {
  const d = store.get(KEY, null);
  const T = DEF();
  if (d && typeof d === 'object') {
    if (typeof d.asal === 'string') T.asal = d.asal;
    if (Array.isArray(d.dest) && d.dest.length) T.dest = d.dest.slice(0, MAX_TUJUAN).map((x) => ({ id: String(x.id || ''), h: Math.max(1, Number(x.h) || 1), m: Math.max(0, Number(x.m) || 0), mm: !!x.mm }));
    if (d.tiket === 'full') T.tiket = 'full';
    if (d.jenis === 'diklat') T.jenis = 'diklat';
    for (const t of TINGKAT) { if (d.org && Number.isFinite(d.org[t.k])) T.org[t.k] = Math.max(0, Math.min(999, d.org[t.k])); if (d.kelas?.[t.k] === 'bis') T.kelas[t.k] = 'bis'; }
  }
  return T;
}

// Ruas transportasi A → B. f = bagian tarif tiket PP yang dipakai (½ atau 1).
function addLeg(add, alt, notes, A, B, people, total, kelas, f, g) {
  const r = computeRoute(A, B);
  if (r.sameKab) { notes.push(`${A.label} dan ${B.label} berada di kabupaten/kota yang sama; ruas ini tidak dihitung transportasinya.`); return false; }
  let hasTiket = false;
  for (const sec of r.sec.filter((s) => ['Keberangkatan', 'Perjalanan', 'Kedatangan'].includes(s.h))) {
    for (const it of sec.items) {
      const row = it.code ? rowBy(it.bid, it.code, it.ti) : null;
      const base = { g, sec: sec.h, cat: it.bid === 'L2-6' ? 'tiket' : it.bid === 'L2-5' ? 'taksi' : 'darat', bid: it.bid, ti: it.ti, code: it.code, label: plain(it.title) };
      if (!row) { add({ ...base, n: null, qty: 0, vol: 'Tidak tercantum di tabel; mengacu harga riil/pasar', missing: true }); continue; }
      if (it.bid === 'L2-6') {
        if (hasTiket) { alt.push(plain(it.title)); continue; }
        hasTiket = true;
        for (const p of people) {
          const bis = kelas[p.k] === 'bis';
          add({ ...base, label: `${plain(it.title)} · ${bis ? 'Bisnis' : 'Ekonomi'}`, sub: p.n, n: row.n[bis ? 3 : 4], qty: p.c * f, vol: `${f === 1 ? 'tarif PP penuh' : '½ tarif PP'} × ${p.c} orang`, per: p.k, perQty: f });
        }
      } else if (it.bid === 'L2-5') {
        add({ ...base, n: row.n[3], qty: total, vol: `1 kali × ${total} orang`, perAll: 1 });
      } else if (it.bid === 'L2-2' || it.bid === 'L2-3') {
        add({ ...base, n: row.n[4], qty: total, vol: `1 kali (sekali jalan) × ${total} orang`, perAll: 1 });
      }
    }
  }
  return hasTiket;
}

export function computeChain(T) {
  const O = resolve(T.asal);
  const D = T.dest.map((d) => (d.id ? resolve(d.id) : null));
  if (!O || !D.length || D.some((x) => !x)) return { ready: false };
  const people = peopleOf(T);
  const total = people.reduce((a, t) => a + t.c, 0);
  const lines = [];
  const add = adder(lines);
  const alt = [], notes = [];
  const stops = [O, ...D, O];
  const f = T.tiket === 'full' ? 1 : 0.5;
  let hasTiket = false;
  const tUH = S.butir['L1-25'].tables[0], vUH = valueCols(tUH);
  const tH = S.butir['L1-27'].tables[0], vH = valueCols(tH);
  const tRep = S.butir['L1-25'].tables[1], repRows = tRep.rows.filter((x) => x.v);
  for (let i = 0; i < stops.length - 1; i++) {
    const A = stops[i], B = stops[i + 1];
    hasTiket = addLeg(add, alt, notes, A, B, people, total, T.kelas, f, `Ruas ${i + 1}: ${plain(A.label)} → ${plain(B.label)}`) || hasTiket;
    if (i === stops.length - 2) break;
    // Selama di tujuan ke-(i+1)
    const d = T.dest[i], P = S.prov[B.prov].nama, g = `Selama di ${plain(B.label)} (${P})`;
    const rUH = tUH.rows.find((x) => x.p === B.prov);
    add({ g, cat: 'uh', bid: 'L1-25', ti: 0, code: rUH?.c, label: `Uang harian · ${P}${T.jenis === 'diklat' ? ' (diklat)' : ''}`, n: rUH ? rUH.n[T.jenis === 'diklat' ? vUH[2] : vUH[0]] : null, qty: d.h * total, vol: `${d.h} hari × ${total} orang`, perAll: d.h, missing: !rUH });
    const rH = tH.rows.find((x) => x.p === B.prov);
    if (d.m > 0) for (const p of people) add({ g, cat: 'inap', bid: 'L1-27', ti: 0, code: rH?.c, label: `Penginapan · ${P}`, sub: p.n, n: rH ? rH.n[vH[p.h]] : null, qty: d.m * p.c, vol: `${d.m} malam × ${p.c} orang`, per: p.k, perQty: d.m, missing: !rH });
    for (const p of people.filter((x) => x.rep != null)) {
      const rr = repRows[p.rep];
      if (rr) add({ g, cat: 'rep', bid: 'L1-25', ti: 1, code: rr.c, label: 'Uang representasi', sub: p.n, n: rr.n[valueCols(tRep)[0]], qty: d.h * p.c, vol: `${d.h} hari × ${p.c} orang`, per: p.k, perQty: d.h });
    }
  }
  const res = finish({ lingkup: 'chain', O, D, alt, hasTiket, notes, f }, lines, people);
  return res;
}

const stp = (id, val, min, max, label) => `<div class="stp sm" data-stp="${id}" data-min="${min}" data-max="${max}"><button type="button" data-d="-1" aria-label="Kurangi ${esc(label)}"${val <= min ? ' disabled' : ''}>−</button><input class="stp-in" type="text" inputmode="numeric" maxlength="3" value="${val}" aria-label="${esc(label)}"><button type="button" data-d="1" aria-label="Tambah ${esc(label)}"${val >= max ? ' disabled' : ''}>+</button></div>`;
const seg = (name, opts, cur) => `<div class="kp-seg" role="radiogroup">${opts.map(([v, t]) => `<button type="button" role="radio" aria-checked="${v === cur}" class="${v === cur ? 'on' : ''}" data-${name}="${v}">${esc(t)}</button>`).join('')}</div>`;
const routeTxt = (T) => [T.asal, ...T.dest.map((d) => d.id), T.asal].map((id) => (id ? placeLabel(id) || resolve(id)?.label || '…' : '…')).join(' → ');

function formHtml(T, ui) {
  const dests = T.dest.map((d, i) => `<div class="tj-d" data-i="${i}">
      <div class="tj-dh"><span class="tj-n">${i + 1}</span><b>Tujuan ${i + 1}</b>${T.dest.length > 1 ? `<button type="button" class="icon-btn sm tj-del" data-del="${i}" aria-label="Hapus tujuan ${i + 1}">${ic('x')}</button>` : ''}</div>
      <div class="route-form">${ui.placeField('tjD' + i, 'Kota tujuan', d.id ? placeLabel(d.id) : '', 'Ketik kota tujuan, mis. Surabaya, Kab. Bojonegoro…')}</div>
      <div class="tj-hm"><span class="kp-lbl">Hari</span>${stp('h:' + i, d.h, 1, 365, `Hari di tujuan ${i + 1}`)}<span class="kp-lbl">Malam ${i === 0 ? tip('Malam menginap di kota ini. Bawaan 1 malam untuk 1 hari, lalu hari dikurangi satu. Bisa 0 sampai sama dengan jumlah hari.') : ''}</span>${stp('m:' + i, d.m, 0, d.h, `Malam di tujuan ${i + 1}`)}</div>
    </div>`).join('');
  return `<div class="card card-pad kp-form">
    <div class="kp-step"><h2 class="kp-h"><span class="step">1</span>Rute surat tugas<button type="button" class="btn sm kp-reset" id="tjReset">${ic('history')} Reset</button></h2>
      <div class="route-form">${ui.placeField('tjAsal', 'Kota asal', placeLabel(T.asal), 'Kota/kabupaten asal')}</div>
      <div class="tj-list">${dests}</div>
      ${T.dest.length < MAX_TUJUAN ? `<button type="button" class="btn sm tj-add" id="tjAdd">${ic('plus')} Tambah tujuan <small>(maks. ${MAX_TUJUAN})</small></button>` : `<div class="muted small">Paling banyak ${MAX_TUJUAN} tujuan dalam satu surat tugas.</div>`}
      <div class="tj-route muted small">${ic('route')}<span id="tjRoute">${esc(routeTxt(T))}</span></div>
      <div class="kp-row"><span class="kp-lbl">Tiket per ruas ${tip('Tabel tiket SBM memuat tarif pergi-pulang (PP). Untuk rute berantai, tiap ruas sekali jalan dihitung setengah tarif PP sebagai pendekatan. Pilih tarif PP penuh bila ingin batas yang lebih longgar.')}</span>${seg('tiket', [['half', '½ tarif PP'], ['full', 'Tarif PP penuh']], T.tiket)}</div>
      <div class="kp-row"><span class="kp-lbl">Uang harian</span>${seg('jenis', [['lk', 'Luar kota'], ['diklat', 'Diklat']], T.jenis)}</div>
    </div>
    <div class="kp-step"><h2 class="kp-h"><span class="step">2</span>Pelaksana</h2>
      <div class="kp-people">${TINGKAT.map((t) => `<div class="kp-p"><span class="kp-pn">${esc(t.n)}</span>
        <select class="sel kp-kelas" data-kelas="${t.k}" aria-label="Kelas tiket ${esc(t.n)}"><option value="eko"${T.kelas[t.k] === 'eko' ? ' selected' : ''}>Ekonomi</option><option value="bis"${T.kelas[t.k] === 'bis' ? ' selected' : ''}>Bisnis</option></select>
        ${stp('org:' + t.k, T.org[t.k], 0, 999, 'Pelaksana ' + t.n)}</div>`).join('')}</div>
      <div class="muted small kp-note">Kelas tiket dipilih per tingkat dan hanya dipakai bila ruasnya memakai tiket pesawat.</div>
    </div>
  </div>`;
}

function resultHtml(T, res, effNotice) {
  if (!res.ready) return '<div class="empty small">Pilih kota asal dan semua kota tujuan untuk menghitung perkiraan biaya.</div>';
  if (!res.total) return '<div class="empty small">Tambahkan minimal satu pelaksana di langkah 2.</div>';
  const { table, per } = resTable(res);
  const hari = T.dest.reduce((a, d) => a + d.h, 0), malam = T.dest.reduce((a, d) => a + d.m, 0);
  const notes = [...res.notes];
  if (res.alt.length) notes.push(`Rute tiket lain yang juga tercantum: ${res.alt.map(esc).join('; ')}. Perhitungan memakai rute pertama tiap ruas.`);
  if (res.missing.length) notes.push('Komponen yang tidak tercantum di tabel tidak ikut dijumlahkan.');
  return `${effNotice()}
  <div class="card kp-res">
    <div class="kp-res-h"><div><div class="kp-title">Perkiraan biaya perjalanan dinas banyak tujuan</div><div class="muted small">${esc(routeTxt(T))} · ${hari} hari ${malam} malam · ${res.total} orang</div></div>
      <div class="kp-actions"><button type="button" class="btn" id="tjPdf">${ic('download')} Unduh PDF</button></div></div>
    ${table}${per}
    <div class="kp-foot muted small">Satuan biaya mengikuti SBM TA ${Y.y} (${esc(Y.src)})${res.effOn ? ', dengan persentase dibayar yang sedang aktif' : ''}. Tiap ruas dihitung sekali jalan: taksi di kota keberangkatan dan kedatangan masing-masing 1 kali, transport darat 1 kali, tiket ${res.f === 1 ? 'tarif PP penuh' : 'setengah tarif PP'} karena tabel tiket SBM memuat tarif pergi-pulang. Uang harian, penginapan, dan representasi mengikuti provinsi tiap tujuan. ${notes.join(' ')}</div>
  </div>`;
}

export function viewTujuan(ui) {
  const T = load();
  const save = () => store.set(KEY, T);
  const html = `<div class="page-head"><h1 class="title">Perjadin (banyak tujuan)</h1><p class="subtitle">Satu surat tugas dengan rute berantai: dari kota asal ke tujuan 1, lanjut ke tujuan berikutnya, lalu kembali ke kota asal. Paling banyak ${MAX_TUJUAN} tujuan. Transportasi dihitung per ruas; uang harian, penginapan, dan representasi per kota tujuan.</p></div>
  <div class="kp tj" id="tjRoot"></div>`;
  const after = () => {
    const { $, $$, toast, effNotice } = ui;
    const root = $('#tjRoot');
    const draw = () => {
      const res = computeChain(T);
      $('.kp-form').classList.toggle('no-tiket', !(res.ready && res.hasTiket));
      $('#tjRoute').textContent = routeTxt(T);
      $('#tjHost').innerHTML = resultHtml(T, res, effNotice);
      const pdf = $('#tjPdf');
      if (pdf) pdf.onclick = async () => {
        pdf.disabled = true; const old = pdf.innerHTML; pdf.innerHTML = `${ic('clock')} Menyiapkan PDF…`;
        try {
          const hari = T.dest.reduce((a, d) => a + d.h, 0), malam = T.dest.reduce((a, d) => a + d.m, 0);
          res.custom = {
            title: 'Perkiraan Biaya Perjalanan Dinas Banyak Tujuan',
            info: [['Rute', plain(routeTxt(T))], ...T.dest.map((d, i) => [`Tujuan ${i + 1}`, `${plain(res.D[i].label)} (${S.prov[res.D[i].prov].nama}), ${d.h} hari ${d.m} malam`]), ['Lama', `${hari} hari, ${malam} malam`], ['Pelaksana', res.people.map((p) => `${p.n} (${p.c})`).join('; ')]],
            notes: [
              `Tiap ruas dihitung sekali jalan: taksi di kota keberangkatan dan kedatangan masing-masing 1 kali, transport darat 1 kali, tiket ${res.f === 1 ? 'tarif PP penuh' : 'setengah tarif PP'} (tabel tiket SBM memuat tarif pergi-pulang).`,
              'Uang harian, penginapan, dan representasi mengikuti provinsi tiap tujuan.',
              'Tiket dan taksi bersifat dapat dilampaui (acuan); uang harian, penginapan, dan representasi bersifat batas tertinggi.',
              ...res.notes,
            ],
            file: `Perkiraan-Perjadin-Banyak-Tujuan-${res.D.map((d) => plain(d.label)).join('-').replace(/[^\w]+/g, '-')}-TA${Y.y}.pdf`.replace(/-+/g, '-'),
          };
          const out = await buildPdf(res);
          const a = document.createElement('a'); a.href = URL.createObjectURL(out.blob); a.download = out.name;
          document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
          toast('PDF diunduh');
        } catch (err) { console.error(err); toast('PDF gagal dibuat'); } finally { pdf.disabled = false; pdf.innerHTML = old; }
      };
    };
    const render = (focusId) => {
      root.innerHTML = formHtml(T, ui) + '<div id="tjHost"></div>';
      ui.attachAC('tjAsal', (it) => { T.asal = it.id; save(); draw(); });
      T.dest.forEach((d, i) => ui.attachAC('tjD' + i, (it) => { T.dest[i].id = it.id; save(); draw(); const nx = $('#tjD' + (i + 1)); if (nx && !T.dest[i + 1].id) setTimeout(() => nx.focus(), 50); }));
      $$('[data-clear]', root).forEach((b) => b.onclick = () => { const inp = $('#' + b.dataset.clear); inp.value = ''; inp.focus(); inp.dispatchEvent(new Event('input')); });
      draw();
      if (focusId) setTimeout(() => $('#' + focusId)?.focus(), 30);
    };
    const get = (id) => { const [k, i] = id.split(':'); return k === 'h' ? T.dest[i].h : k === 'm' ? T.dest[i].m : T.org[i]; };
    const apply = (el, v, keepText = false) => {
      const id = el.dataset.stp, min = Number(el.dataset.min), max = Number(el.dataset.max);
      v = Math.max(min, Math.min(max, Number.isFinite(v) ? v : min));
      const [k, i] = id.split(':');
      if (!keepText) el.querySelector('input').value = v;
      el.querySelector('[data-d="-1"]').disabled = v <= min;
      el.querySelector('[data-d="1"]').disabled = v >= max;
      if (k === 'h') {
        const d = T.dest[i]; d.h = v;
        d.m = d.mm ? Math.min(d.m, v) : Math.min(v, autoMalam(v));
        const m = $(`[data-stp="m:${i}"]`, root); m.dataset.max = v; m.querySelector('input').value = d.m;
        m.querySelector('[data-d="-1"]').disabled = d.m <= 0; m.querySelector('[data-d="1"]').disabled = d.m >= v;
      } else if (k === 'm') { T.dest[i].m = v; T.dest[i].mm = true; }
      else T.org[i] = v;
      save(); draw();
    };
    root.addEventListener('click', (e) => {
      const b = e.target.closest('.stp button');
      if (b) { const el = b.closest('.stp'); apply(el, get(el.dataset.stp) + Number(b.dataset.d)); return; }
      const del = e.target.closest('[data-del]');
      if (del) { T.dest.splice(Number(del.dataset.del), 1); save(); render(); return; }
      if (e.target.closest('#tjAdd')) { if (T.dest.length < MAX_TUJUAN) { T.dest.push({ id: '', h: 1, m: 1, mm: false }); save(); render('tjD' + (T.dest.length - 1)); } return; }
      if (e.target.closest('#tjReset')) { Object.assign(T, DEF()); save(); render(); toast('Isian dikembalikan ke awal'); return; }
      const sg = e.target.closest('[data-tiket],[data-jenis]');
      if (sg) {
        const k = sg.dataset.tiket ? 'tiket' : 'jenis';
        T[k] = sg.dataset[k];
        $$(`[data-${k}]`, root).forEach((x) => { x.classList.toggle('on', x === sg); x.setAttribute('aria-checked', String(x === sg)); });
        save(); draw();
      }
    });
    root.addEventListener('input', (e) => {
      const inp = e.target.closest('.stp-in'); if (!inp) return;
      inp.value = inp.value.replace(/\D/g, ''); if (inp.value === '') return;
      apply(inp.closest('.stp'), Number(inp.value), true);
    });
    root.addEventListener('focusout', (e) => { const inp = e.target.closest('.stp-in'); if (!inp) return; const el = inp.closest('.stp'); apply(el, inp.value === '' ? get(el.dataset.stp) : Number(inp.value)); });
    root.addEventListener('focusin', (e) => { const inp = e.target.closest('.stp-in'); if (inp) inp.select(); });
    root.addEventListener('keydown', (e) => { const inp = e.target.closest('.stp-in'); if (inp && e.key === 'Enter') inp.blur(); });
    root.addEventListener('change', (e) => { const s = e.target.closest('[data-kelas]'); if (s) { T.kelas[s.dataset.kelas] = s.value; save(); draw(); } });
    render();
  };
  return { html, after };
}
