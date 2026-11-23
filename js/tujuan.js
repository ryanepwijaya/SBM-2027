// Perjadin (banyak tujuan): satu surat tugas, rute berantai asal → T1 → T2 → T3 → asal (paling banyak 3 tujuan).
// Tiap ruas dihitung dengan mesin SBM Perjalanan (taksi, tiket, transport darat), tiap tujuan dengan uang harian,
// penginapan, dan representasi provinsinya. Angka SBM × volume; ketentuan PMK Perjalanan Dinas hanya yang berupa rumus atas angka SBM
// (kelas pesawat Lampiran IV, penginapan 30% Pasal 8 ayat (5)), dengan rujukan pasal.
import { S, Y, esc, fmt, store, tip, valueCols, pdRef, pdTxt } from './store.js';
import { resolve, computeRoute, rowBy, placeLabel } from './rute.js';
import { ic } from './icons.js';
import { TINGKAT, plain, adder, finish, peopleOf, resTable, buildPdf, autoMalam, KELAS_IV, kelasOf, kelasCellIV, peopleTable, wizHead, wizBar, wizUpdate, wizGo, editBtn, wizCols } from './hitung.js';

let WZ = 1; // halaman alur: 1 isi data, 2 estimasi

export const MAX_TUJUAN = 3;
const KEY = 'tujuan';
const DEF = () => ({
  asal: 'jakarta', dest: [{ id: '', h: 1, m: 1, mm: false }], tiket: 'half', jenis: 'lk', inap: 'hotel',
  org: { pn: 0, e1: 0, pnl: 0, e2: 0, e3: 0, e4: 1 }, kelasA: {},
});
function load() {
  const d = store.get(KEY, null);
  const T = DEF();
  if (d && typeof d === 'object') {
    if (typeof d.asal === 'string') T.asal = d.asal;
    if (Array.isArray(d.dest) && d.dest.length) T.dest = d.dest.slice(0, MAX_TUJUAN).map((x) => ({ id: String(x.id || ''), h: Math.max(1, Number(x.h) || 1), m: Math.max(0, Number(x.m) || 0), mm: !!x.mm }));
    if (d.tiket === 'full') T.tiket = 'full';
    if (d.jenis === 'diklat') T.jenis = 'diklat';
    if (d.inap === 'non') T.inap = 'non';
    if (d.kelasA && typeof d.kelasA === 'object') for (const k of ['pn', 'e1']) if (d.kelasA[k] === 'eko') T.kelasA[k] = 'eko';
    for (const t of TINGKAT) { if (d.org && Number.isFinite(d.org[t.k])) T.org[t.k] = Math.max(0, Math.min(999, d.org[t.k])); }
  }
  return T;
}

// Ruas transportasi A → B. f = bagian tarif tiket PP yang dipakai (½ atau 1).
function addLeg(add, alt, notes, A, B, people, total, f, g, kelas = KELAS_IV) {
  const r = computeRoute(A, B);
  if (r.sameKab) { notes.push(`${A.label} dan ${B.label} berada di kabupaten/kota yang sama; ruas ini tidak dihitung transportasinya.`); return false; }
  let hasTiket = false;
  for (const sec of r.sec.filter((s) => ['Keberangkatan', 'Perjalanan', 'Kedatangan'].includes(s.h))) {
    for (const it of sec.items) {
      const row = it.code ? rowBy(it.bid, it.code, it.ti) : null;
      const base = { g, sec: sec.h, cat: it.bid === 'L2-6' ? 'tiket' : it.bid === 'L2-5' ? 'taksi' : 'darat', bid: it.bid, ti: it.ti, code: it.code, label: plain(it.title), byr: 'R' };
      if (!row) { add({ ...base, n: null, qty: 0, vol: 'Tidak tercantum di tabel; mengacu harga riil/pasar', missing: true }); continue; }
      if (it.bid === 'L2-6') {
        if (hasTiket) { alt.push(plain(it.title)); continue; }
        hasTiket = true;
        for (const p of people) {
          const bis = kelas[p.k] === 'bis';
          add({ ...base, label: `${plain(it.title)} · ${bis ? 'Bisnis' : 'Ekonomi'}${f === 1 ? '' : ' · sekali jalan'}`, sub: p.n, n: row.n[bis ? 3 : 4], qty: p.c * f, vol: `${f === 1 ? 'tarif PP penuh' : 'sekali jalan (½ tarif PP)'} × ${p.c} orang`, per: p.k, perQty: f });
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
    hasTiket = addLeg(add, alt, notes, A, B, people, total, f, `Ruas ${i + 1}: ${plain(A.label)} → ${plain(B.label)}`, kelasOf(T.kelasA)) || hasTiket;
    if (i === stops.length - 2) break;
    // Selama di tujuan ke-(i+1)
    const d = T.dest[i], P = S.prov[B.prov].nama, g = `Selama di ${plain(B.label)} (${P})`;
    const rUH = tUH.rows.find((x) => x.p === B.prov);
    add({ g, cat: 'uh', bid: 'L1-25', ti: 0, code: rUH?.c, label: `Uang harian · ${P}${T.jenis === 'diklat' ? ' (diklat)' : ''}`, n: rUH ? rUH.n[T.jenis === 'diklat' ? vUH[2] : vUH[0]] : null, qty: d.h * total, vol: `${d.h} hari × ${total} orang`, perAll: d.h, missing: !rUH, byr: 'L' });
    const rH = tH.rows.find((x) => x.p === B.prov);
    const non = T.inap === 'non', fi = non ? 0.3 : 1;
    if (d.m > 0) for (const p of people) add({ g, cat: 'inap', bid: 'L1-27', ti: 0, code: rH?.c, label: non ? `Penginapan, tidak menginap di hotel · ${P}` : `Penginapan · ${P}`, sub: p.n, n: rH ? rH.n[vH[p.h]] : null, qty: d.m * p.c * fi, vol: `${non ? '30% × ' : ''}${d.m} malam × ${p.c} orang`, per: p.k, perQty: d.m * fi, missing: !rH, byr: non ? 'L' : 'R', pd: non ? 'inap30' : null });
    for (const p of people.filter((x) => x.rep != null)) {
      const rr = repRows[p.rep];
      if (rr) add({ g, cat: 'rep', bid: 'L1-25', ti: 1, code: rr.c, label: 'Uang representasi', sub: p.n, n: rr.n[valueCols(tRep)[0]], qty: d.h * p.c, vol: `${d.h} hari × ${p.c} orang`, per: p.k, perQty: d.h, byr: 'L' });
    }
  }
  const res = finish({ lingkup: 'chain', O, D, alt, hasTiket, notes, f, non: T.inap === 'non' }, lines, people);
  return res;
}

const stp = (id, val, min, max, label) => `<div class="stp sm" data-stp="${id}" data-min="${min}" data-max="${max}"><button type="button" data-d="-1" aria-label="Kurangi ${esc(label)}"${val <= min ? ' disabled' : ''}>−</button><input class="stp-in" type="text" inputmode="numeric" maxlength="3" value="${val}" aria-label="${esc(label)}"><button type="button" data-d="1" aria-label="Tambah ${esc(label)}"${val >= max ? ' disabled' : ''}>+</button></div>`;
const seg = (name, opts, cur) => `<div class="kp-seg" role="radiogroup">${opts.map(([v, t]) => `<button type="button" role="radio" aria-checked="${v === cur}" class="${v === cur ? 'on' : ''}" data-${name}="${v}">${esc(t)}</button>`).join('')}</div>`;
const routeTxt = (T) => [T.asal, ...T.dest.map((d) => d.id), T.asal].map((id) => (id ? placeLabel(id) || resolve(id)?.label || '…' : '…')).join(' → ');

function formHtml(T, ui) {
  const dests = T.dest.map((d, i) => `<div class="tj-d" data-i="${i}">
      <div class="tj-dh"><span class="tj-n">${i + 1}</span><b>Tujuan ${i + 1}</b>${T.dest.length > 1 ? `<button type="button" class="icon-btn sm tj-del" data-del="${i}" aria-label="Hapus tujuan ${i + 1}">${ic('x')}</button>` : ''}</div>
      <div class="route-form">${ui.placeField('tjD' + i, 'Kota tujuan', d.id ? placeLabel(d.id) : '', 'Ketik kota tujuan, mis. Surabaya, Kab. Bojonegoro…')}</div>
      <div class="tj-hm"><div class="tj-f"><span class="kp-lbl">Hari</span>${stp('h:' + i, d.h, 1, 365, `Hari di tujuan ${i + 1}`)}</div><div class="tj-f"><span class="kp-lbl">Malam ${i === 0 ? tip('Malam menginap di kota ini. Bawaan 1 malam untuk 1 hari, lalu hari dikurangi satu. Bisa 0 sampai sama dengan jumlah hari.') : ''}</span>${stp('m:' + i, d.m, 0, d.h, `Malam di tujuan ${i + 1}`)}</div></div>
    </div>`).join('');
  return `<div class="card card-pad kp-form">
    <div class="kp-step"><h2 class="kp-h"><span class="step">1</span>Rute surat tugas<button type="button" class="btn sm danger kp-reset" id="tjReset">${ic('history')} Reset</button></h2>
      <div class="route-form">${ui.placeField('tjAsal', 'Kota asal', placeLabel(T.asal), 'Kota/kabupaten asal')}</div>
      <div class="tj-list">${dests}</div>
      ${T.dest.length < MAX_TUJUAN ? `<button type="button" class="btn sm tj-add" id="tjAdd">${ic('plus')} Tambah tujuan <small>(maks. ${MAX_TUJUAN})</small></button>` : `<div class="muted small">Paling banyak ${MAX_TUJUAN} tujuan dalam satu surat tugas.</div>`}
      <div class="tj-route muted small">${ic('route')}<span id="tjRoute">${esc(routeTxt(T))}</span></div>
      <div class="kp-row"><span class="kp-lbl">Tiket per ruas ${tip('Tabel tiket SBM memuat tarif pergi-pulang (PP). Tiket sekali jalan dihitung ½ dari tarif PP SBM. Pilih tarif PP penuh bila ingin memakai angka PP apa adanya.')}</span>${seg('tiket', [['half', 'Sekali jalan'], ['full', 'Tarif PP penuh']], T.tiket)}</div>
      <div class="muted small kp-mini">${T.tiket === 'half' ? 'Sekali jalan = ½ dari tarif PP di tabel tiket SBM.' : 'Memakai tarif PP di tabel tiket SBM apa adanya.'} Taksi dan transport darat 1 kali per ruas.</div>
      <div class="kp-row"><span class="kp-lbl">Uang harian</span>${seg('jenis', [['lk', 'Luar kota'], ['diklat', 'Diklat']], T.jenis)}</div>
      <div class="kp-row"><span class="kp-lbl">Penginapan ${tip('Bila pelaksana tidak menginap di hotel atau tempat menginap lainnya, diberikan biaya penginapan 30% dari tarif hotel di kota tujuan, dibayar lumpsum (Pasal 8 ayat (5) PMK 113/PMK.05/2012).')}</span>${seg('inap', [['hotel', 'Di hotel'], ['non', 'Tidak di hotel (30%)']], T.inap)}</div>
      <div class="kp-pd">${pdRef('inap30')}</div>
    </div>
    <div class="kp-step"><h2 class="kp-h"><span class="step">2</span>Pelaksana</h2>
      ${peopleTable(TINGKAT, (t) => kelasCellIV(t, T.kelasA), (t) => stp('org:' + t.k, T.org[t.k], 0, 999, 'Pelaksana ' + t.n))}
      <div class="muted small kp-note">Kelas pesawat sesuai ${pdRef('lamp4')}.</div>
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
      <div class="kp-actions">${editBtn()}<button type="button" class="btn primary" id="tjPdf">${ic('download')} Unduh PDF</button></div></div>
    ${table}${per}
    <div class="kp-foot muted small">Satuan biaya mengikuti SBM TA ${Y.y} (${esc(Y.src)})${res.effOn ? ', dengan persentase dibayar yang sedang aktif' : ''}. Tiap ruas dihitung sekali jalan: taksi di kota keberangkatan dan kedatangan masing-masing 1 kali, transport darat 1 kali, tiket ${res.f === 1 ? 'tarif PP penuh' : 'sekali jalan (½ dari tarif PP SBM)'}. Uang harian, penginapan, dan representasi mengikuti provinsi tiap tujuan.${res.non ? ' Penginapan dihitung 30% dari tarif hotel karena tidak menginap di hotel.' : ''} ${notes.join(' ')}</div>
  </div>`;
}

export function viewTujuan(ui) {
  const T = load();
  const save = () => store.set(KEY, T);
  const html = `<div class="page-head"><h1 class="title">Perjadin (banyak tujuan)</h1><p class="subtitle">Satu surat tugas dengan rute berantai: dari kota asal ke tujuan 1, lanjut ke tujuan berikutnya, lalu kembali ke kota asal. Paling banyak ${MAX_TUJUAN} tujuan. Transportasi dihitung per ruas; uang harian, penginapan, dan representasi per kota tujuan.</p></div>
  <div class="kp tj wz" id="tjRoot" data-wz="${WZ}"></div>`;
  const after = () => {
    const { $, $$, toast, effNotice } = ui;
    const root = $('#tjRoot');
    const missingOf = () => {
      const m = [];
      T.dest.forEach((d, i) => { if (!d.id) m.push(`kota tujuan ${i + 1}`); });
      if (!Object.values(T.org).some((v) => v > 0)) m.push('jumlah pelaksana');
      return m;
    };
    const draw = () => {
      const res = computeChain(T);
      $('.kp-form').classList.toggle('no-tiket', !(res.ready && res.hasTiket));
      const miss = missingOf();
      wizUpdate(root, miss);
      $('.wz-s1', root).textContent = miss.length ? 'Belum lengkap' : `${T.dest.length} tujuan · ${res.total} orang`;
      if (miss.length && WZ === 2) { WZ = 1; wizGo(root, 1); }
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
              `Tiap ruas dihitung sekali jalan: taksi di kota keberangkatan dan kedatangan masing-masing 1 kali, transport darat 1 kali, tiket ${res.f === 1 ? 'tarif PP penuh' : 'sekali jalan (1/2 dari tarif PP SBM, karena tabel tiket memuat tarif pergi-pulang)'}.`,
              'Uang harian, penginapan, dan representasi mengikuti provinsi tiap tujuan.',
              `Kelas pesawat mengikuti ${pdTxt('lamp4')}. Cara bayar (lumpsum/biaya riil) mengikuti ${pdTxt('lumpsum')}.`,
              ...(res.non ? [`Tidak menginap di hotel: penginapan 30% dari tarif hotel kota tujuan, dibayar lumpsum (${pdTxt('inap30')}).`] : []),
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
      root.innerHTML = wizHead(WZ, 'Rute, lama, pelaksana', 'Rincian dan PDF') + formHtml(T, ui) + wizBar() + '<div id="tjHost"></div>';
      wizCols($('.kp-form', root));
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
      const w = e.target.closest('button[data-wz]');
      if (w) { if (!w.disabled) { WZ = Number(w.dataset.wz); wizGo(root, WZ); } return; }
      const b = e.target.closest('.stp button');
      if (b) { const el = b.closest('.stp'); apply(el, get(el.dataset.stp) + Number(b.dataset.d)); return; }
      const del = e.target.closest('[data-del]');
      if (del) { T.dest.splice(Number(del.dataset.del), 1); save(); render(); return; }
      if (e.target.closest('#tjAdd')) { if (T.dest.length < MAX_TUJUAN) { T.dest.push({ id: '', h: 1, m: 1, mm: false }); save(); render('tjD' + (T.dest.length - 1)); } return; }
      if (e.target.closest('#tjReset')) { Object.assign(T, DEF()); WZ = 1; root.dataset.wz = '1'; save(); render(); toast('Isian dikembalikan ke awal'); return; }
      const sg = e.target.closest('[data-tiket],[data-jenis],[data-inap]');
      if (sg) {
        const k = ['tiket', 'jenis', 'inap'].find((x) => sg.dataset[x] != null);
        T[k] = sg.dataset[k];
        $$(`[data-${k}]`, root).forEach((x) => { x.classList.toggle('on', x === sg); x.setAttribute('aria-checked', String(x === sg)); });
        save(); draw();
        if (k === 'tiket') { const m = $('.kp-mini', root); if (m) m.textContent = `${T.tiket === 'half' ? 'Sekali jalan = ½ dari tarif PP di tabel tiket SBM.' : 'Memakai tarif PP di tabel tiket SBM apa adanya.'} Taksi dan transport darat 1 kali per ruas.`; }
      }
    });
    root.addEventListener('input', (e) => {
      const inp = e.target.closest('.stp-in'); if (!inp) return;
      inp.value = inp.value.replace(/\D/g, ''); if (inp.value === '') return;
      apply(inp.closest('.stp'), Number(inp.value), true);
    });
    root.addEventListener('focusout', (e) => { const inp = e.target.closest('.stp-in'); if (!inp) return; const el = inp.closest('.stp'); apply(el, inp.value === '' ? get(el.dataset.stp) : Number(inp.value)); });
    root.addEventListener('focusin', (e) => { const inp = e.target.closest('.stp-in'); if (inp) inp.select(); });
    root.addEventListener('change', (e) => { const s = e.target.closest('[data-kelasa]'); if (s) { T.kelasA[s.dataset.kelasa] = s.value; save(); draw(); } });
    root.addEventListener('keydown', (e) => { const inp = e.target.closest('.stp-in'); if (inp && e.key === 'Enter') inp.blur(); });
    render();
  };
  return { html, after };
}
