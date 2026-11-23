// Uji Perjalanan: menguji angka riil tagihan perjalanan dinas luar kota (satu pelaksana) terhadap satuan biaya SBM.
// Komponen dan sifatnya (batas tertinggi / dapat dilampaui, lumpsum / biaya riil) diambil dari mesin Hitung Perjalanan;
// aplikasi tidak menetapkan aturan sendiri, hanya membandingkan dan menandai.
import { S, Y, esc, fmt, store, tip, pdRef, pdTxt } from './store.js';
import { resolve, placeLabel } from './rute.js';
import { ic } from './icons.js';
import { TINGKAT, compute, autoMalam, plain, TIER_A, kelasCellIV, sifatChip, byrChip, BYR, wizHeadN, wizGo, wizCols, buildTablePdf, pdfButton } from './hitung.js';

const KEY = 'uji';
let WZ = 1;
const DEF = () => ({ dari: 'jakarta', ke: '', jenis: 'lk', hari: 2, malam: 1, mm: false, tk: 'e4', kelasA: {}, inap: 'hotel', riil: {}, ok: {}, extra: [] });
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
  const rows = res.lines.filter((l) => !l.manual).map((l) => ({
    k: `${l.cat}|${l.label}`, l, label: l.label, g: l.g,
    vol: String(l.vol || '').replace(/ × [\d.,]+ orang$/, '').replace(/^1 orang$/, '1 tiket'),
    sbm: l.n == null ? null : Math.round(l.n * l.qty), unit: l.n,
  }));
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
function resultHtml(T, ev) {
  if (!ev.items.length) return '';
  const t = TINGKAT.find((x) => x.k === T.tk);
  const groups = [...new Set(ev.items.map((x) => x.g))];
  const rows = groups.map((g) => `<tr class="grp"><td colspan="5">${esc(g)}</td></tr>` + ev.items.filter((x) => x.g === g).map((x) => `<tr>
      <td><div class="kp-k">${esc(x.label)}</div><div class="kp-sub">${esc(x.vol)}</div><div class="kp-meta">${x.l.sifat ? sifatChip(x.l.sifat) : ''}${x.l.byr ? byrChip(x.l) : ''}${x.l.ref ? `<a class="chip ref" href="${x.l.ref.href}">${esc(x.l.ref.label)}</a>` : ''}${x.l.pd ? pdRef(x.l.pd) : ''}</div></td>
      <td class="n" data-l="SBM">${x.sbm == null ? '<span class="na">Tidak tercantum</span>' : fmt(x.sbm)}</td>
      <td class="n" data-l="Riil">${fmt(x.riil)}</td>
      <td class="n" data-l="Selisih">${x.j.d == null || x.j.d === 0 ? '–' : `${x.j.d > 0 ? '+' : '−'}${fmt(Math.abs(x.j.d))}`}</td>
      <td data-l="Status"><span class="uj-b ${BADGE[x.j.s]}">${esc(x.j.t)}</span></td>
    </tr>`).join('')).join('')
    + (ev.extra.length ? `<tr class="grp"><td colspan="5">Komponen lain (tidak diuji)</td></tr>` + ev.extra.map((x) => `<tr><td><div class="kp-k">${esc(x.label)}</div></td><td class="n" data-l="SBM"><span class="na">–</span></td><td class="n" data-l="Riil">${fmt(x.riil || 0)}</td><td class="n" data-l="Selisih">–</td><td data-l="Status"><span class="uj-b mute">Tidak diuji</span></td></tr>`).join('') : '');
  const over = ev.items.filter((x) => x.j.s === 'over');
  return `<div class="card kp-res">
    <div class="kp-res-h"><div><div class="kp-title">Hasil uji perjalanan dinas</div><div class="muted small">${esc(`${plain(ev.res.O.label)} – ${plain(ev.res.D.label)} · ${T.hari} hari ${T.malam} malam · ${t.n}`)}</div></div>
      <div class="kp-actions"><button type="button" class="btn" data-wz="2">${ic('pencil-line')} Ubah kertas kerja</button><button type="button" class="btn primary" id="ujPdf">${ic('download')} Unduh PDF</button></div></div>
    <div class="uj-sum">
      <div class="uj-k ${over.length ? 'bad' : 'ok'}">${ic(over.length ? 'alert' : 'check')}<div><b>${over.length ? `${over.length} komponen melebihi batas tertinggi` : 'Tidak ada komponen yang melebihi batas tertinggi'}</b><span>${over.length ? `Kelebihan ${fmt(ev.lebih)}: ${over.map((x) => esc(x.label)).join(', ')}` : 'Semua komponen bersifat batas tertinggi berada dalam SBM.'}</span></div></div>
      ${ev.dl > 0 ? `<div class="uj-k warn">${ic('info')}<div><b>Di atas acuan ${fmt(ev.dl)}</b><span>Komponen bersifat dapat dilampaui; perlu penjelasan/dokumen pendukung sesuai ketentuan.</span></div></div>` : ''}
    </div>
    <div class="tbl-wrap kp-tbl"><table class="t kp-t uj-t">
      <thead><tr><th>Komponen</th><th class="n">SBM</th><th class="n">Riil</th><th class="n">Selisih</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr class="sub"><td>Total satuan biaya SBM (komponen yang tercantum)</td><td class="n">${fmt(ev.totSbm)}</td><td colspan="3"></td></tr>
        <tr class="sub"><td>Total riil di tagihan</td><td colspan="2" class="n">${fmt(ev.totRiil)}</td><td colspan="2"></td></tr>
        <tr class="sub"><td>Kelebihan di atas batas tertinggi</td><td colspan="2" class="n">${ev.lebih ? '−' + fmt(ev.lebih) : fmt(0)}</td><td colspan="2"></td></tr>
        <tr><td>Total riil setelah dikurangi kelebihan</td><td colspan="2" class="n">${fmt(ev.totRiil - ev.lebih)}</td><td colspan="2"></td></tr>
      </tfoot>
    </table></div>
    <div class="kp-foot muted small">SBM TA ${Y.y} (${esc(Y.src)}) dihitung penuh (100%) untuk volume yang tertera. Sifat komponen mengikuti SBM: batas tertinggi tidak boleh dilampaui; dapat dilampaui berarti angka SBM sebagai acuan. Cara bayar mengikuti ${pdRef('lumpsum')}. Hasil uji ini alat bantu, bukan keputusan pengujian; keputusan tetap pada PPK sesuai ketentuan.</div>
  </div>`;
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
      $('#ujHost').innerHTML = miss1().length || miss2().length ? '' : resultHtml(T, ev);
      pdfButton($('#ujPdf'), () => {        const t = TINGKAT.find((x) => x.k === T.tk);
        const body = ev.items.map((x) => [`${plain(x.label)}\n${plain(x.vol)}`, [x.l.ref?.label, x.l.sifat === 'BT' ? 'Batas tertinggi' : x.l.sifat ? 'Dapat dilampaui' : '', x.l.byr ? BYR[x.l.byr] : ''].filter(Boolean).join('\n'), x.sbm == null ? 'Tidak tercantum' : fmt(x.sbm), fmt(x.riil), x.j.d ? `${x.j.d > 0 ? '+' : '-'}${fmt(Math.abs(x.j.d))}` : '-', x.j.t]);
        for (const x of ev.extra) body.push([plain(x.label), 'Tidak ada di SBM', '-', fmt(x.riil || 0), '-', 'Tidak diuji']);
        return buildTablePdf({
          title: 'Lembar Uji Perjalanan Dinas', sub: `Angka riil tagihan dibandingkan dengan SBM TA ${Y.y} (${Y.src})`,
          info: [['Perjalanan', `${plain(ev.res.O.label)} - ${plain(ev.res.D.label)} (${S.prov[ev.res.D.prov].nama})`], ['Lama', `${T.hari} hari, ${T.malam} malam${T.inap === 'non' ? ', tidak menginap di hotel' : ''}`], ['Pelaksana', `1 orang, ${t.n}`], ['Uang harian', T.jenis === 'diklat' ? 'Diklat' : 'Luar kota']],
          sections: [{
            head: ['Komponen', 'Rujukan dan sifat', 'SBM', 'Riil', 'Selisih', 'Status'], body,
            foot: [[{ content: 'Total riil di tagihan', colSpan: 3 }, fmt(ev.totRiil), { content: '', colSpan: 2 }], [{ content: 'Kelebihan di atas batas tertinggi', colSpan: 3 }, ev.lebih ? '-' + fmt(ev.lebih) : fmt(0), { content: '', colSpan: 2 }], [{ content: 'Total riil setelah dikurangi kelebihan', colSpan: 3 }, fmt(ev.totRiil - ev.lebih), { content: '', colSpan: 2 }]],
            right: [2, 3, 4], cols: { 1: { cellWidth: 30 }, 2: { cellWidth: 25 }, 3: { cellWidth: 25 }, 4: { cellWidth: 22 }, 5: { cellWidth: 30 } },
          }],
          notes: [
            'SBM dihitung penuh (100%) untuk volume yang tertera; volume mengikuti lama perjalanan dan rute (taksi dan transport darat 2 kali, berangkat dan pulang).',
            'Sifat komponen mengikuti SBM: batas tertinggi tidak boleh dilampaui; dapat dilampaui berarti angka SBM sebagai acuan.',
            `Cara bayar (lumpsum/biaya riil) mengikuti ${pdTxt('lumpsum')}; komponen tanpa bukti pengeluaran dipertanggungjawabkan dengan Daftar Pengeluaran Riil (Pasal 34 ayat (3) PMK 113/2012).`,
            'Komponen lain dicatat sesuai isian dan tidak diuji karena tidak ada satuan biayanya di SBM untuk rute ini.',
            'Lembar ini alat bantu, bukan keputusan pengujian; keputusan tetap pada PPK sesuai ketentuan.',
          ],
          file: `Uji-Perjalanan-${plain(ev.res.D.label).replace(/[^\w]+/g, '-')}-TA${Y.y}.pdf`,
        });
      }, toast);
    };
    const render = (focusSel) => {
      ev = evaluate(T);
      root.innerHTML = wizHeadN(WZ, [['Isi data', 'Perjalanan dan pelaksana'], ['Kertas kerja', 'Sandingkan SBM dan riil'], ['Hasil uji', 'Ringkasan dan PDF']])
        + formHtml(T, ui, ev) + bar(1, 'Lanjut ke kertas kerja') + `<div id="ujWork">${workHtml(T, ev)}</div>` + bar(2, 'Lihat hasil uji') + '<div id="ujHost"></div>';
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
