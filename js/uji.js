// Uji Perjalanan: menguji angka riil tagihan perjalanan dinas luar kota (satu pelaksana) terhadap satuan biaya SBM.
// Komponen dan sifatnya (batas tertinggi / dapat dilampaui, lumpsum / biaya riil) diambil dari mesin Hitung Perjalanan;
// aplikasi tidak menetapkan aturan sendiri, hanya membandingkan dan menandai.
import { S, Y, esc, fmt, store, tip, pdRef, pdTxt } from './store.js';
import { resolve, placeLabel } from './rute.js';
import { ic } from './icons.js';
import { TINGKAT, compute, autoMalam, plain, TIER_A, kelasCellIV, sifatChip, byrChip, wizHeadN, wizGo, wizCols, downloadBlob } from './hitung.js';
import { P, T as Tbl, docx, terbilang } from './docx-mini.js';

const KEY = 'uji';
let WZ = 1;
const DEF = () => ({ dari: 'jakarta', ke: '', jenis: 'lk', hari: 2, malam: 1, mm: false, tk: 'e4', kelasA: {}, inap: 'hotel', riil: {}, ok: {}, nob: {}, extra: [] });
const digits = (s) => String(s ?? '').replace(/\D/g, '');
const rp = (s) => { const d = digits(s); return d ? Number(d) : null; };
const rpTxt = (n) => (n == null ? '' : Number(n).toLocaleString('id-ID'));

function load() {
  const T = DEF();
  const d = store.get(KEY, null);
  if (d && typeof d === 'object') {
    for (const k of ['dari', 'ke', 'jenis', 'tk', 'inap']) if (typeof d[k] === 'string') T[k] = d[k];
    for (const k of ['hari', 'malam']) if (Number.isFinite(d[k])) T[k] = Math.max(0, Math.min(365, Math.round(d[k])));
    T.mm = !!d.mm;
    if (d.kelasA && typeof d.kelasA === 'object') for (const k of TIER_A) if (d.kelasA[k] === 'eko') T.kelasA[k] = 'eko';
    if (d.riil && typeof d.riil === 'object') for (const [k, v] of Object.entries(d.riil)) if (typeof v === 'string') T.riil[String(k).slice(0, 200)] = digits(v).slice(0, 13);
    if (d.ok && typeof d.ok === 'object') for (const [k, v] of Object.entries(d.ok)) if (v === true) T.ok[String(k).slice(0, 200)] = true;
    if (d.nob && typeof d.nob === 'object') for (const [k, v] of Object.entries(d.nob)) if (v === true) T.nob[String(k).slice(0, 200)] = true;
    if (Array.isArray(d.extra)) T.extra = d.extra.slice(0, 10).map((x) => ({ l: String(x?.l ?? '').slice(0, 120), a: digits(x?.a).slice(0, 13) }));
  }
  if (!TINGKAT.some((t) => t.k === T.tk)) T.tk = 'e4';
  if (!['lk', 'diklat'].includes(T.jenis)) T.jenis = 'lk';
  if (T.inap !== 'non') T.inap = 'hotel';
  T.hari = Math.max(1, T.hari); T.malam = Math.min(T.malam, T.hari);
  return T;
}

// Komponen SBM untuk satu pelaksana, dari mesin Hitung Perjalanan
function components(T) {
  const res = compute({ lingkup: 'dn', dari: T.dari, ke: T.ke, jenis: T.jenis, hari: T.hari, malam: T.malam, inap: T.inap, org: Object.fromEntries(TINGKAT.map((t) => [t.k, t.k === T.tk ? 1 : 0])), kelasA: T.kelasA });
  if (!res.ready || res.dalamKota || !res.lines) return { res, rows: [] };
  const rows = [];
  const O = plain(res.O.label), D = plain(res.D.label);
  for (const l of res.lines) {
    if (l.manual) continue;
    if (l.cat === 'tiket') {
      // Tiket SBM tarif pergi-pulang: diuji per arah, masing-masing ½ tarif PP
      if (l.n == null) { res.noTiket = true; continue; }
      const kls = /Bisnis/.test(l.label) ? 'Bisnis' : 'Ekonomi';
      const half = Math.round(l.n / 2);
      rows.push({ k: 'tiket|go', l, label: `Tiket pesawat berangkat · ${O} – ${D} · ${kls}`, g: l.g, vol: '1 tiket (½ tarif PP SBM)', sbm: half, unit: half });
      rows.push({ k: 'tiket|back', l, label: `Tiket pesawat pulang · ${D} – ${O} · ${kls}`, g: l.g, vol: '1 tiket (½ tarif PP SBM)', sbm: l.n - half, unit: l.n - half });
      continue;
    }
    rows.push({ k: `${l.cat}|${l.label}`, l, label: l.label, g: l.g, vol: String(l.vol || '').replace(/ × [\d.,]+ orang$/, ''), sbm: l.n == null ? null : Math.round(l.n * l.qty), unit: l.n });
  }
  return { res, rows };
}

// Status uji per komponen: hanya membandingkan dengan SBM menurut sifatnya
function judge(row, riil) {
  if (riil == null) return { s: 'kosong', t: 'Belum diisi' };
  if (riil === 0) return { s: 'nol', t: 'Tidak ditagihkan', d: 0 };
  if (row.sbm == null) return { s: 'na', t: 'Tidak tercantum di SBM' };
  const d = riil - row.sbm;
  if (d > 0) return row.l.sifat === 'BT' ? { s: 'over', t: 'Melebihi batas tertinggi', d } : { s: 'dl', t: 'Di atas acuan (dapat dilampaui)', d };
  if (d < 0) return { s: 'under', t: `Di bawah SBM (${Math.round((riil / row.sbm) * 100)}%)`, d };
  return { s: 'ok', t: 'Sesuai SBM', d: 0 };
}

function evaluate(T) {
  const { res, rows } = components(T);
  const items = rows.map((r) => {
    const ok = !!T.ok[r.k] && r.sbm != null;
    const riil = ok ? r.sbm : T.riil[r.k] != null && T.riil[r.k] !== '' ? Number(T.riil[r.k]) : null;
    return { ...r, ok, riil, j: judge(r, riil) };
  });
  const extra = T.extra.map((x) => ({ label: x.l || 'Komponen lain', riil: rp(x.a) }));
  const totRiil = items.reduce((a, x) => a + (x.riil || 0), 0) + extra.reduce((a, x) => a + (x.riil || 0), 0);
  const totSbm = items.reduce((a, x) => a + (x.sbm || 0), 0);
  const lebih = items.filter((x) => x.j.s === 'over').reduce((a, x) => a + x.j.d, 0);
  items.forEach((x) => { x.paid = x.riil == null ? 0 : x.j.s === 'over' ? x.sbm : x.riil; });
  const dl = items.filter((x) => x.j.s === 'dl').reduce((a, x) => a + x.j.d, 0);
  return { res, items, extra, totRiil, totSbm, lebih, dl };
}

const stp = (id, val, min, max, label) => `<div class="stp sm" data-stp="${id}" data-min="${min}" data-max="${max}"><button type="button" data-d="-1" aria-label="Kurangi ${esc(label)}"${val <= min ? ' disabled' : ''}>−</button><input class="stp-in" type="text" inputmode="numeric" maxlength="3" value="${val}" aria-label="${esc(label)}"><button type="button" data-d="1" aria-label="Tambah ${esc(label)}"${val >= max ? ' disabled' : ''}>+</button></div>`;
const seg = (name, opts, cur) => `<div class="kp-seg" role="radiogroup">${opts.map(([v, t]) => `<button type="button" role="radio" aria-checked="${v === cur}" class="${v === cur ? 'on' : ''}" data-${name}="${v}">${esc(t)}</button>`).join('')}</div>`;

function formHtml(T, ui, ev) {
  const t = TINGKAT.find((x) => x.k === T.tk);
  return `<div class="card card-pad kp-form">
    <div class="kp-step"><h2 class="kp-h"><span class="step">1</span>Perjalanan<button type="button" class="btn sm danger kp-reset" id="ujReset">${ic('history')} Reset</button></h2>
      <div class="route-form">${ui.placeField('ujDari', 'Dari', placeLabel(T.dari), 'Kota/kabupaten asal')}${ui.placeField('ujKe', 'Ke', T.ke ? placeLabel(T.ke) : '', 'Kota/kabupaten tujuan')}</div>
      <div class="kp-row"><span class="kp-lbl">Uang harian</span>${seg('jenis', [['lk', 'Luar kota'], ['diklat', 'Diklat']], T.jenis)}</div>
    </div>
    <div class="kp-step"><h2 class="kp-h"><span class="step">2</span>Lama dan pelaksana</h2>
      <div class="kp-row"><span class="kp-lbl">Hari</span>${stp('hari', T.hari, 1, 365, 'hari')}</div>
      <div class="kp-row"><span class="kp-lbl">Malam menginap</span>${stp('malam', T.malam, 0, T.hari, 'malam')}</div>
      <label class="kp-fld"><span>Tingkat pelaksana</span><select class="sel" id="ujTk">${TINGKAT.map((x) => `<option value="${x.k}"${x.k === T.tk ? ' selected' : ''}>${esc(x.n)}</option>`).join('')}</select></label>
      <div class="kp-row"><span class="kp-lbl">Kelas pesawat</span>${kelasCellIV(t, T.kelasA)}</div>
      <div class="kp-row"><span class="kp-lbl">Penginapan ${tip('Bila tidak menginap di hotel atau tempat menginap lainnya, penginapan dibayar 30% dari tarif hotel, lumpsum (Pasal 8 ayat (5) PMK 113/PMK.05/2012).')}</span>${seg('inap', [['hotel', 'Di hotel'], ['non', 'Tidak di hotel (30%)']], T.inap)}</div>
      <div class="kp-pd">${pdRef('lamp4')}</div>
    </div>
  </div>`;
}

// Kertas kerja: penyandingan SBM dengan angka riil tagihan, selisih dan status langsung
const statusCell = (x) => `<span class="uj-b ${BADGE[x.j.s]}">${esc(x.j.t)}</span>`;
const diffTxt = (x) => (x.j.d == null || x.j.d === 0 ? '–' : `${x.j.d > 0 ? '+' : '−'}${fmt(Math.abs(x.j.d))}`);
function workHtml(T, ev) {
  if (!ev.items.length) return '';
  const groups = [...new Set(ev.items.map((x) => x.g))];
  const can = ev.items.filter((x) => x.sbm != null);
  const all = can.length && can.every((x) => x.ok);
  const rows = groups.map((g) => `<tr class="grp"><td colspan="6">${esc(g)}</td></tr>` + ev.items.map((x, i) => (x.g !== g ? '' : `<tr data-i="${i}" class="${x.ok ? 'is-ok' : ''}">
      <td><div class="kp-k">${esc(x.label)}</div><div class="kp-sub">${esc(x.vol)}</div><div class="kp-meta">${x.l.sifat ? sifatChip(x.l.sifat) : ''}${x.l.byr ? byrChip(x.l) : ''}</div></td>
      <td class="n" data-l="SBM">${x.sbm == null ? '<span class="na">Tidak tercantum</span>' : fmt(x.sbm)}</td>
      <td class="c" data-l="Sesuai SBM"><label class="uj-cb"><input type="checkbox" data-ok="${esc(x.k)}"${x.ok ? ' checked' : ''}${x.sbm == null ? ' disabled' : ''} aria-label="${esc(x.label)} sesuai SBM"></label></td>
      <td class="n" data-l="Riil"><span class="kp-kurs uj-in"><b>Rp</b><input data-rk="${esc(x.k)}" type="text" inputmode="numeric" autocomplete="off" placeholder="${x.sbm == null ? 'Isi, atau 0' : 'Jumlah riil'}" value="${esc(x.riil == null ? '' : rpTxt(x.riil))}"${x.ok ? ' readonly tabindex="-1"' : ''} aria-label="Riil ${esc(x.label)}"></span></td>
      <td class="n uj-d" data-l="Selisih">${diffTxt(x)}</td>
      <td class="uj-s" data-l="Status">${statusCell(x)}</td>
    </tr>`)).join('')).join('');
  return `<div class="card kp-res uj-work">
    <div class="kp-res-h"><div><div class="kp-title">Kertas kerja uji</div><div class="muted small">Centang <b>Sesuai SBM</b> bila angka tagihan sama dengan SBM, atau isi angka riilnya. Isi 0 bila tidak ditagihkan. Selisih dan status langsung muncul.</div></div>
      <label class="iv-lock uj-all"><input type="checkbox" id="ujAll"${all ? ' checked' : ''}${can.length ? '' : ' disabled'}><span>Centang semua sesuai SBM</span></label></div>
    <div class="tbl-wrap kp-tbl"><table class="t kp-t uj-t uj-w">
      <thead><tr><th>Komponen</th><th class="n">SBM</th><th class="c">Sesuai SBM</th><th class="n">Riil</th><th class="n">Selisih</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr class="sub"><td>Total</td><td class="n" id="ujTs">${fmt(ev.totSbm)}</td><td></td><td class="n" id="ujTr">${fmt(ev.totRiil)}</td><td class="n" id="ujTl" colspan="2"></td></tr></tfoot>
    </table></div>
    ${ev.res.noTiket ? `<div class="muted small uj-nt">${ic('info')} Tarif tiket pesawat untuk rute ini tidak tercantum di SBM. Bila ada tiket di tagihan, tambahkan sebagai komponen lain.</div>` : ''}
    <div class="uj-xwrap">
      <div class="uj-x-h">Komponen lain di tagihan ${tip('Komponen yang tidak ada di satuan biaya SBM untuk rute ini, misalnya kereta api atau biaya lain. Dicatat di hasil, tetapi tidak diuji.')}</div>
      <div class="uj-list">${T.extra.map((x, i) => `<div class="uj-r uj-x">
        <input class="iv-in uj-xl" data-xl="${i}" type="text" autocomplete="off" maxlength="120" placeholder="Uraian, mis. Kereta api Jakarta–Bandung PP" value="${esc(x.l)}" aria-label="Uraian komponen lain ${i + 1}">
        <span class="kp-kurs uj-in"><b>Rp</b><input data-xa="${i}" type="text" inputmode="numeric" autocomplete="off" placeholder="Jumlah" value="${esc(rpTxt(rp(x.a)))}" aria-label="Jumlah komponen lain ${i + 1}"></span>
        <button type="button" class="btn sm ghost uj-del" data-xdel="${i}" aria-label="Hapus komponen lain ${i + 1}">${ic('x')}</button>
      </div>`).join('')}</div>
      ${T.extra.length < 10 ? `<button type="button" class="btn sm" id="ujAdd">${ic('plus')} Tambah komponen lain</button>` : ''}
    </div>
  </div>`;
}
const bar = (n, label) => `<div class="card card-pad wz-bar uj-bar uj-bar${n}"><div class="wz-miss small" aria-live="polite"></div><button type="button" class="btn primary" data-wz="${n + 1}">${esc(label)} ${ic('chevron-right')}</button></div>`;

const BADGE = { ok: 'ok', under: 'ok', nol: 'mute', over: 'bad', dl: 'warn', na: 'mute', kosong: 'mute' };
// Komponen yang masuk dokumen: dibayar > 0; komponen lain ikut sebagai transportasi/biaya lain sesuai isian
function docRows(T, ev) {
  const its = ev.items.filter((x) => x.paid > 0).map((x) => ({ key: x.k, x, label: x.label.replace(/ · /g, ', '), paid: x.paid, cat: x.l.cat, byr: x.l.byr, over: x.j.s === 'over' ? x.riil : null }));
  const ext = ev.extra.map((x, i) => ({ key: `x:${i}`, label: x.label, paid: x.riil || 0, cat: 'lain', byr: 'R' })).filter((x) => x.paid > 0);
  return { its, ext, total: its.reduce((a, x) => a + x.paid, 0) + ext.reduce((a, x) => a + x.paid, 0) };
}
function summaryHtml(T, ev) {
  const t = TINGKAT.find((x) => x.k === T.tk);
  const d = docRows(T, ev);
  const cnt = (s) => ev.items.filter((x) => x.j.s === s).length;
  const riilItems = [...d.its.filter((x) => x.byr === 'R'), ...d.ext];
  const anyNob = riilItems.some((x) => T.nob[x.key]);
  const pills = [['ok', 'sesuai SBM', cnt('ok')], ['ok', 'di bawah SBM', cnt('under')], ['bad', 'melebihi batas tertinggi', cnt('over')], ['warn', 'di atas acuan', cnt('dl')], ['mute', 'tidak ditagihkan', cnt('nol')], ['mute', 'tidak tercantum di SBM', cnt('na')]].filter((x) => x[2]);
  return `<div class="card kp-res uj-fin">
    <div class="kp-res-h"><div><div class="kp-title">Ringkasan dan dokumen</div><div class="muted small">${esc(`${plain(ev.res.O.label)} – ${plain(ev.res.D.label)} · ${T.hari} hari ${T.malam} malam · ${t.n}`)}</div></div>
      <div class="kp-actions"><button type="button" class="btn" data-wz="2">${ic('pencil-line')} Ubah kertas kerja</button></div></div>
    <div class="uj-stats">
      <div><span>Total SBM</span><b>${fmt(ev.totSbm)}</b></div>
      <div><span>Total riil di tagihan</span><b>${fmt(ev.totRiil)}</b></div>
      <div class="${ev.lebih ? 'bad' : ''}"><span>Melebihi batas tertinggi</span><b>${ev.lebih ? '−' + fmt(ev.lebih) : fmt(0)}</b></div>
      <div class="tot"><span>Jumlah dibayar</span><b>${fmt(d.total)}</b></div>
    </div>
    <div class="uj-pills">${pills.map(([c, n, k]) => `<span class="uj-b ${c}">${k} komponen ${esc(n)}</span>`).join('')}</div>
    ${ev.lebih ? `<div class="callout small uj-note">${ic('info')}<div>Komponen bersifat batas tertinggi yang melebihi SBM dicantumkan di dokumen sebesar SBM; kelebihannya ${fmt(ev.lebih)} tidak ikut dibayar.</div></div>` : ''}
    <div class="uj-nob">
      <div class="uj-x-h">Komponen tanpa bukti pengeluaran ${tip('Biaya transpor dan/atau penginapan yang tidak dapat diperoleh bukti pengeluarannya dipertanggungjawabkan dengan Daftar Pengeluaran Riil (Pasal 34 ayat (3) dan Lampiran IX PMK 113/PMK.05/2012). Uang harian dan komponen lumpsum tidak termasuk.')}</div>
      ${riilItems.length ? `<div class="uj-nobl">${riilItems.map((x) => `<label class="iv-lock"><input type="checkbox" data-nob="${esc(x.key)}"${T.nob[x.key] ? ' checked' : ''}><span>${esc(x.label)} <small class="muted">${fmt(x.paid)}</small></span></label>`).join('')}</div>` : '<div class="muted small">Tidak ada komponen biaya riil yang dibayar.</div>'}
    </div>
    <div class="uj-dl">
      <button type="button" class="btn primary" id="ujDocK">${ic('download')} Kuitansi</button>
      <button type="button" class="btn primary" id="ujDocR">${ic('download')} Rincian Biaya</button>
      <button type="button" class="btn primary" id="ujDocD"${anyNob ? '' : ' disabled'}>${ic('download')} Daftar Pengeluaran Riil</button>
    </div>
    <div class="kp-foot muted small">Dokumen berupa draf Word (.docx) tanpa kop dan identitas. Lengkapi nomor, tanggal, nama, NIP, dan tanda tangan, lalu periksa kembali sebelum dipakai. Format Rincian Biaya mengikuti ${pdRef('lamp2')}; Daftar Pengeluaran Riil mengikuti ${pdRef('lamp9')}.${anyNob ? '' : ' Daftar Pengeluaran Riil aktif setelah ada komponen yang dicentang tanpa bukti.'}</div>
  </div>`;
}

// ---------- Dokumen Word ----------
const DOT = '……………………';
const rpN = (n) => `Rp${Number(n || 0).toLocaleString('id-ID')}`;
const sign = (title, role) => [P(title, { after: 0 }), P(role, { after: 0 }), P('', { after: 0 }), P('', { after: 0 }), P('', { after: 0 }), P(`(${DOT})`, { after: 0 }), P(`NIP ${DOT}`, { after: 0 })];
const kv = (rows, widths = [4.2, 0.5, 12.3]) => Tbl(rows.map(([k, v, o = {}]) => [{ c: k }, { c: ':' }, { c: v, b: o.b, ...o }]), { widths, border: false, pad: 0.05 });
const fname = (s, ev) => `${s}-${plain(ev.res.D.label).replace(/[^\w]+/g, '-')}-TA${Y.y}.docx`.replace(/-+/g, '-');

function docKuitansi(T, ev) {
  const d = docRows(T, ev);
  const body = [
    Tbl([[{ c: '' }, { c: 'TA' }, { c: ':' }, { c: String(Y.y) }], [{ c: '' }, { c: 'Nomor Bukti' }, { c: ':' }, { c: DOT }], [{ c: '' }, { c: 'Mata Anggaran' }, { c: ':' }, { c: DOT }]], { widths: [8.5, 3.2, 0.5, 4.8], border: false, pad: 0.05 }),
    P('', { after: 6 }),
    P([{ t: 'KUITANSI / BUKTI PEMBAYARAN', b: true, u: true }], { align: 'center', size: 13, after: 14 }),
    kv([
      ['Sudah terima dari', `Kuasa Pengguna Anggaran/Pejabat Pembuat Komitmen\nSatker ${DOT}`],
      ['Jumlah Uang', rpN(d.total), { b: true }],
      ['Terbilang', [{ t: terbilang(d.total), i: true }]],
      ['Untuk Pembayaran', 'Perjalanan Dinas Dalam Negeri menurut:'],
    ]),
    Tbl([[{ c: '' }, { c: 'SPD Nomor' }, { c: `${DOT} a.n. ${DOT}` }], [{ c: '' }, { c: 'Tanggal' }, { c: DOT }], [{ c: '' }, { c: 'Dari' }, { c: plain(ev.res.O.label) }], [{ c: '' }, { c: 'Ke' }, { c: plain(ev.res.D.label) }]], { widths: [4.7, 3, 9.3], border: false, pad: 0.05 }),
    P('', { after: 10 }),
    Tbl([[{ c: '' }, { c: [P(`${DOT}, ${DOT}`, { after: 0 }), ...sign('', 'Yang bepergian/Penerima kuasa,').slice(1)] }]], { widths: [9, 8], border: false }),
    P('', { after: 10 }),
    Tbl([[{ c: [P('Setuju dibebankan pada mata anggaran berkenaan,', { after: 0 }), P('a.n. Kuasa Pengguna Anggaran', { after: 0 }), ...sign('', 'Pejabat Pembuat Komitmen,').slice(1)] }, { c: [P(`Lunas dibayar tanggal ${DOT}`, { after: 0 }), P('', { after: 0 }), ...sign('', 'Bendahara Pengeluaran,').slice(1)] }]], { widths: [8.5, 8.5], border: 'outer', pad: 0.25 }),
  ].join('');
  return { blob: docx(body, { title: 'Kuitansi Perjalanan Dinas' }), name: fname('Kuitansi-Perjadin', ev) };
}

function rincianRows(T, ev) {
  const d = docRows(T, ev);
  const prov = S.prov[ev.res.D.prov].nama;
  const ket = (x) => [x.over != null ? `Riil ${rpN(x.over)}; dibayar sebatas SBM` : '', x.byr === 'L' ? 'Lumpsum' : x.byr === 'R' ? 'Biaya riil' : '', T.nob[x.key] ? 'Daftar Pengeluaran Riil' : ''].filter(Boolean).join('; ');
  const per = (x, n, sat) => (n > 0 && x.paid % n === 0 ? `${prov}, ${n} ${sat} x ${rpN(x.paid / n)}` : `${prov}, ${n} ${sat}`);
  const groups = [
    ['Uang Transport', [...d.its.filter((x) => !['uh', 'inap', 'rep'].includes(x.cat)).map((x) => ({ t: x.label, a: x.paid, k: ket(x) })), ...d.ext.map((x) => ({ t: x.label, a: x.paid, k: [x.byr === 'R' ? 'Biaya riil' : '', T.nob[x.key] ? 'Daftar Pengeluaran Riil' : ''].filter(Boolean).join('; ') }))]],
    ['Uang Harian', d.its.filter((x) => x.cat === 'uh').map((x) => ({ t: per(x, T.hari, 'hari'), a: x.paid, k: ket(x) }))],
    ['Uang Penginapan', d.its.filter((x) => x.cat === 'inap').map((x) => ({ t: `${T.inap === 'non' ? 'Tidak menginap di hotel (30%), ' : ''}${per(x, T.malam, 'malam')}`, a: x.paid, k: ket(x) }))],
    ['Uang Representasi', d.its.filter((x) => x.cat === 'rep').map((x) => ({ t: per(x, T.hari, 'hari'), a: x.paid, k: ket(x) }))],
  ].filter(([, r]) => r.length);
  return { groups, total: d.total };
}
function docRincian(T, ev) {
  const { groups, total } = rincianRows(T, ev);
  const rows = [[{ c: 'No', b: true, align: 'center', shade: 'E8EBF5' }, { c: 'PERINCIAN BIAYA', b: true, align: 'center', shade: 'E8EBF5' }, { c: 'JUMLAH', b: true, align: 'center', shade: 'E8EBF5' }, { c: 'KETERANGAN', b: true, align: 'center', shade: 'E8EBF5' }]];
  groups.forEach(([g, r], i) => {
    rows.push([{ c: `${i + 1}.`, align: 'center' }, { c: `${g} (${rpN(r.reduce((a, x) => a + x.a, 0))})`, b: true }, { c: '' }, { c: '' }]);
    r.forEach((x) => rows.push([{ c: '' }, { c: `- ${x.t}` }, { c: rpN(x.a), align: 'right' }, { c: x.k, size: 9 }]));
  });
  rows.push([{ c: '' }, { c: 'JUMLAH', b: true }, { c: rpN(total), b: true, align: 'right' }, { c: '' }]);
  rows.push([{ c: '' }, { c: [{ t: `Terbilang: ${terbilang(total)}`, i: true }], span: 3 }]);
  const body = [
    P([{ t: 'RINCIAN BIAYA PERJALANAN DINAS', b: true }], { align: 'center', size: 13, after: 12 }),
    kv([['Lampiran SPD Nomor', DOT], ['Tanggal', DOT]], [4.2, 0.5, 12.3]),
    P('', { after: 6 }),
    Tbl(rows, { widths: [1.1, 8.4, 3.4, 4.1] }),
    P('', { after: 8 }),
    Tbl([[{ c: '' }, { c: P(`${DOT}, ${DOT}`, { after: 0 }) }], [{ c: [P('Telah dibayar sejumlah', { after: 0 }), P(rpN(total), { b: true, after: 0 }), ...sign('', 'Bendahara Pengeluaran,').slice(1)] }, { c: [P('Telah menerima jumlah uang sebesar', { after: 0 }), P(rpN(total), { b: true, after: 0 }), ...sign('', 'Yang Menerima,').slice(1)] }]], { widths: [8.5, 8.5], border: false }),
    P('', { after: 8 }),
    P([{ t: 'PERHITUNGAN SPD RAMPUNG', b: true }], { align: 'center', after: 6 }),
    kv([['Ditetapkan sejumlah', rpN(total)], ['Yang telah dibayar semula', `Rp${DOT}`], ['Sisa kurang/lebih', `Rp${DOT}`]], [5.5, 0.5, 11]),
    P('', { after: 6 }),
    Tbl([[{ c: '' }, { c: sign('', 'Pejabat Pembuat Komitmen,').slice(1) }]], { widths: [9, 8], border: false }),
  ].join('');
  return { blob: docx(body, { title: 'Rincian Biaya Perjalanan Dinas' }), name: fname('Rincian-Biaya-Perjadin', ev) };
}

function docDpr(T, ev) {
  const d = docRows(T, ev);
  const list = [...d.its.filter((x) => x.byr === 'R'), ...d.ext].filter((x) => T.nob[x.key]);
  const tot = list.reduce((a, x) => a + x.paid, 0);
  const rows = [[{ c: 'No', b: true, align: 'center', shade: 'E8EBF5' }, { c: 'Uraian', b: true, align: 'center', shade: 'E8EBF5' }, { c: 'Jumlah', b: true, align: 'center', shade: 'E8EBF5' }],
    ...list.map((x, i) => [{ c: `${i + 1}.`, align: 'center' }, { c: x.label }, { c: rpN(x.paid), align: 'right' }]),
    [{ c: 'Jumlah', b: true, span: 2, align: 'right' }, { c: rpN(tot), b: true, align: 'right' }]];
  const body = [
    P([{ t: 'DAFTAR PENGELUARAN RIIL', b: true }], { align: 'center', size: 13, after: 12 }),
    P('Yang bertandatangan di bawah ini:', { after: 4 }),
    kv([['Nama', DOT], ['NIP', DOT], ['Jabatan', DOT]], [3.5, 0.5, 13]),
    P(`berdasarkan Surat Perjalanan Dinas (SPD) Nomor ${DOT} tanggal ${DOT}, dengan ini kami menyatakan dengan sesungguhnya bahwa:`, { before: 6 }),
    P('1.  Biaya transpor pegawai dan/atau biaya penginapan di bawah ini yang tidak dapat diperoleh bukti-bukti pengeluarannya, meliputi:', { indent: 0.6, hanging: 0.6, align: 'both' }),
    Tbl(rows, { widths: [1.1, 11.4, 4.5] }),
    P('2.  Jumlah uang tersebut pada angka 1 di atas benar-benar dikeluarkan untuk pelaksanaan Perjalanan Dinas dimaksud dan apabila di kemudian hari terdapat kelebihan atas pembayaran, kami bersedia untuk menyetorkan kelebihan tersebut ke Kas Negara.', { indent: 0.6, hanging: 0.6, align: 'both', before: 8 }),
    P('Demikian pernyataan ini kami buat dengan sebenarnya, untuk dipergunakan sebagaimana mestinya.', { align: 'both', before: 6, after: 10 }),
    Tbl([[{ c: [P('Mengetahui/Menyetujui:', { after: 0 }), ...sign('', 'Pejabat Pembuat Komitmen,').slice(1)] }, { c: [P(`${DOT}, ${DOT}`, { after: 0 }), ...sign('', 'Pelaksana SPD,').slice(1)] }]], { widths: [8.5, 8.5], border: false }),
  ].join('');
  return { blob: docx(body, { title: 'Daftar Pengeluaran Riil' }), name: fname('Daftar-Pengeluaran-Riil', ev) };
}

export function viewUji(ui) {
  const T = load();
  const save = () => store.set(KEY, T);
  const html = `<div class="page-head"><h1 class="title">Uji Perjalanan</h1><p class="subtitle">Uji angka riil tagihan perjalanan dinas luar kota satu pelaksana terhadap SBM: komponen mana yang sesuai, di bawah, atau melebihi batas tertinggi.</p></div>
  <div class="kp uj wz" id="ujRoot" data-wz="${WZ}"></div>`;
  const after = () => {
    const { $, $$, toast } = ui;
    const root = $('#ujRoot');
    let ev = evaluate(T);
    const miss1 = () => (!T.ke ? ['kota tujuan'] : ev.res.dalamKota ? ['kota tujuan di luar kabupaten/kota asal'] : []);
    const miss2 = () => {
      const m = [];
      const empty = ev.items.filter((x) => x.riil == null).length;
      if (empty) m.push(`angka riil ${empty} komponen`);
      if (T.extra.some((x) => (x.l && !digits(x.a)) || (!x.l && digits(x.a)))) m.push('uraian dan jumlah komponen lain');
      return m;
    };
    const setBar = (sel, miss, okTxt) => {
      const bx = $(sel, root); if (!bx) return;
      $('.wz-miss', bx).innerHTML = miss.length ? `${ic('info')}<span>Lengkapi dulu: ${miss.map((x) => `<b>${esc(x)}</b>`).join(', ')}.</span>` : `${ic('check')}<span>${okTxt}</span>`;
      bx.classList.toggle('ok', !miss.length);
      $('button[data-wz]', bx).disabled = !!miss.length;
    };
    const gate = () => {
      const m1 = miss1(), m2 = m1.length ? ['data perjalanan'] : miss2();
      setBar('.uj-bar1', m1, 'Data perjalanan lengkap.');
      setBar('.uj-bar2', m2, 'Semua komponen sudah terisi.');
      const st = $$('.wz-steps .ms-st', root);
      st[1].disabled = !!m1.length; st[2].disabled = !!(m1.length || m2.length);
      $('.wz-s1', root).textContent = m1.length ? 'Belum lengkap' : `${plain(ev.res.D.label)} · ${T.hari} hari · ${TINGKAT.find((x) => x.k === T.tk).s}`;
      $('.wz-s2', root).textContent = m1.length ? 'Sandingkan SBM dan riil' : m2.length ? `${ev.items.filter((x) => x.riil != null).length} dari ${ev.items.length} komponen terisi` : 'Lengkap';
      if ((WZ >= 2 && m1.length) || (WZ === 3 && m2.length)) { WZ = m1.length ? 1 : 2; wizGo(root, WZ); }
      return { m1, m2 };
    };
    // Perbarui sel selisih, status, dan total tanpa membangun ulang tabel (fokus input tetap)
    const refresh = () => {
      ev = evaluate(T);
      ev.items.forEach((x, i) => {
        const tr = $(`.uj-w tr[data-i="${i}"]`, root); if (!tr) return;
        tr.classList.toggle('is-ok', x.ok);
        $('.uj-d', tr).textContent = diffTxt(x);
        $('.uj-s', tr).innerHTML = statusCell(x);
      });
      const ts = $('#ujTr', root); if (ts) ts.textContent = fmt(ev.totRiil);
      const tl = $('#ujTl', root); if (tl) tl.innerHTML = ev.lebih ? `<span class="uj-b bad">Melebihi batas tertinggi ${fmt(ev.lebih)}</span>` : '';
      const all = $('#ujAll', root); const can = ev.items.filter((x) => x.sbm != null); if (all) all.checked = can.length && can.every((x) => x.ok);
      gate();
      drawResult();
    };
    const drawResult = () => {
      $('#ujHost').innerHTML = miss1().length || miss2().length ? '' : summaryHtml(T, ev);
      const dl = (id, make) => { const b = $(id); if (b) b.onclick = () => { try { downloadBlob(make(T, ev)); toast('Dokumen Word diunduh'); } catch (err) { console.error(err); toast('Dokumen gagal dibuat'); } }; };
      dl('#ujDocK', docKuitansi); dl('#ujDocR', docRincian); dl('#ujDocD', docDpr);
    };
    const render = (focusSel) => {
      ev = evaluate(T);
      root.innerHTML = wizHeadN(WZ, [['Isi data', 'Perjalanan dan pelaksana'], ['Kertas kerja', 'Sandingkan SBM dan riil'], ['Dokumen', 'Ringkasan dan unduh']])
        + formHtml(T, ui, ev) + bar(1, 'Lanjut ke kertas kerja') + `<div id="ujWork">${workHtml(T, ev)}</div>` + bar(2, 'Lanjut ke dokumen') + '<div id="ujHost"></div>';
      wizCols($('.kp-form', root));
      ui.attachAC('ujDari', (it) => { T.dari = it.id; save(); render(); });
      ui.attachAC('ujKe', (it) => { T.ke = it.id; save(); render(); });
      $$('[data-clear]', root).forEach((b) => b.onclick = () => { const inp = $('#' + b.dataset.clear); inp.value = ''; inp.focus(); inp.dispatchEvent(new Event('input')); });
      refresh();
      if (focusSel) setTimeout(() => $(focusSel, root)?.focus(), 40);
    };
    const apply = (el, v) => {
      const id = el.dataset.stp, min = Number(el.dataset.min), max = Number(el.dataset.max);
      v = Math.max(min, Math.min(max, Number.isFinite(v) ? v : min));
      if (id === 'hari') { T.hari = v; T.malam = T.mm ? Math.min(T.malam, v) : Math.min(v, autoMalam(v)); }
      else { T.malam = v; T.mm = true; }
      save(); render();
    };
    root.addEventListener('click', (e) => {
      const w = e.target.closest('button[data-wz]');
      if (w) { if (!w.disabled) { WZ = Number(w.dataset.wz); wizGo(root, WZ); } return; }
      const b = e.target.closest('.stp button');
      if (b) { const el = b.closest('.stp'); apply(el, Number(el.querySelector('input').value) + Number(b.dataset.d)); return; }
      const sg = e.target.closest('[data-jenis],[data-inap]');
      if (sg) { const k = sg.dataset.jenis != null ? 'jenis' : 'inap'; if (T[k] !== sg.dataset[k]) { T[k] = sg.dataset[k]; save(); render(); } return; }
      if (e.target.closest('#ujAdd')) { T.extra.push({ l: '', a: '' }); save(); redrawWork(); setTimeout(() => $(`[data-xl="${T.extra.length - 1}"]`, root)?.focus(), 30); return; }
      const del = e.target.closest('[data-xdel]');
      if (del) { T.extra.splice(Number(del.dataset.xdel), 1); save(); redrawWork(); return; }
      if (e.target.closest('#ujReset')) { Object.assign(T, DEF()); WZ = 1; root.dataset.wz = '1'; save(); render(); toast('Isian dikembalikan ke awal'); }
    });
    root.addEventListener('input', (e) => {
      const el = e.target;
      if (el.dataset.rk != null || el.dataset.xa != null) {
        const d = digits(el.value).slice(0, 13); el.value = d ? Number(d).toLocaleString('id-ID') : '';
        if (el.dataset.rk != null) T.riil[el.dataset.rk] = d; else T.extra[Number(el.dataset.xa)].a = d;
        save(); refresh(); return;
      }
      if (el.dataset.xl != null) { T.extra[Number(el.dataset.xl)].l = el.value.slice(0, 120); save(); refresh(); return; }
      if (el.classList.contains('stp-in')) { const v = parseInt(digits(el.value), 10); if (Number.isFinite(v)) { const st = el.closest('.stp'); if (st.dataset.stp === 'hari') { T.hari = Math.max(1, Math.min(365, v)); T.malam = T.mm ? Math.min(T.malam, T.hari) : Math.min(T.hari, autoMalam(T.hari)); } else { T.malam = Math.max(0, Math.min(T.hari, v)); T.mm = true; } save(); } }
    });
    root.addEventListener('focusout', (e) => { if (e.target.classList.contains('stp-in')) render(); });
    root.addEventListener('focusin', (e) => { const inp = e.target.closest('.stp-in, [data-rk], [data-xa]'); if (inp) inp.select(); });
    const redrawWork = () => { ev = evaluate(T); $('#ujWork', root).innerHTML = workHtml(T, ev); refresh(); };
    root.addEventListener('change', (e) => {
      const nb = e.target.closest('[data-nob]');
      if (nb) { if (nb.checked) T.nob[nb.dataset.nob] = true; else delete T.nob[nb.dataset.nob]; save(); drawResult(); return; }
      const ok = e.target.closest('[data-ok]');
      if (ok) { if (ok.checked) T.ok[ok.dataset.ok] = true; else delete T.ok[ok.dataset.ok]; save(); redrawWork(); return; }
      if (e.target.id === 'ujAll') { const on = e.target.checked; for (const x of ev.items) if (x.sbm != null) { if (on) T.ok[x.k] = true; else delete T.ok[x.k]; } save(); redrawWork(); return; }
      if (e.target.id === 'ujTk') { T.tk = e.target.value; save(); render(); }
      const s = e.target.closest('[data-kelasa]'); if (s) { T.kelasA[s.dataset.kelasa] = s.value; save(); render(); }
    });
    root.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const el = e.target.closest('[data-rk]'); if (!el) return;
      e.preventDefault();
      const all = $$('[data-rk]', root); const i = all.indexOf(el);
      const nx = all.slice(i + 1).find((x) => !x.readOnly); if (nx) nx.focus(); else { const b = $('.uj-bar2 button[data-wz]', root); if (b && !b.disabled) b.click(); }
    });
    render();
  };
  return { html, after };
}
