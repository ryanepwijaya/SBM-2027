// Kalkulator Perjadin: perkiraan biaya perjalanan dinas dalam negeri dari tujuan, lama, dan pelaksana.
// Hanya menampilkan angka SBM yang relevan dikali volume; tidak menerapkan aturan PMK Perjalanan Dinas.
import { S, Y, esc, fmt, valueCols, money, effVal, effPct, pctTxt, fold, tip } from './store.js';
import { resolve, computeRoute, rowBy } from './rute.js';
import { ic } from './icons.js';

// Tingkat pelaksana mengikuti kolom tabel penginapan; rep = baris tabel uang representasi
export const TINGKAT = [
  { k: 'pn', n: 'Pejabat Negara/Wakil Menteri', h: 0, rep: 0 },
  { k: 'e1', n: 'Pejabat Eselon I', h: 0, rep: 1 },
  { k: 'pnl', n: 'Pejabat Negara Lainnya', h: 1, rep: null },
  { k: 'e2', n: 'Pejabat Eselon II', h: 1, rep: 2 },
  { k: 'e3', n: 'Pejabat Eselon III/Golongan IV', h: 2, rep: null },
  { k: 'e4', n: 'Pejabat Eselon IV/Golongan III/II/I', h: 3, rep: null },
];

// Isian bertahan selama aplikasi terbuka (tidak disimpan ke perangkat)
export const KP = {
  dari: 'jakarta', ke: '', jenis: 'lk', hari: 3, malam: 2, malamManual: false,
  org: { pn: 0, e1: 0, pnl: 0, e2: 0, e3: 0, e4: 1 },
  kelas: { pn: 'eko', e1: 'eko', pnl: 'eko', e2: 'eko', e3: 'eko', e4: 'eko' },
};

const refOf = (bid, ti, code) => {
  const b = S.butir[bid];
  const r = code ? rowBy(bid, code, ti) : null;
  return { label: `${b.lamp === 1 ? 'Lamp. I' : 'Lamp. II'} angka ${r?.v?.[0] || b.no}`, href: `#/b/${bid}?t=${ti}${code ? '&r=' + encodeURIComponent(code) : ''}` };
};
const plain = (s) => String(s).replace(/⇄/g, '–').replace(/→/g, '–');

// Hitung semua baris biaya
export function compute(state = KP) {
  const O = resolve(state.dari), D = state.ke ? resolve(state.ke) : null;
  if (!O || !D) return { ready: false };
  const people = TINGKAT.filter((t) => state.org[t.k] > 0).map((t) => ({ ...t, c: state.org[t.k] }));
  const total = people.reduce((a, t) => a + t.c, 0);
  const r = computeRoute(O, D);
  if (r.sameKab) return { ready: true, O, D, r, dalamKota: true };
  const lines = [];
  const add = (x) => {
    const t = S.butir[x.bid].tables[x.ti];
    const unit = x.n != null ? effVal(t, x.n, t.cur) : null;
    lines.push({ ...x, t, unit, amount: unit != null ? unit * x.qty : null, sifat: S.butir[x.bid].sifat, ref: refOf(x.bid, x.ti, x.code) });
  };
  let hasTiket = false;
  const alt = [];
  // Transportasi dari mesin Rute (taksi, tiket, transport darat, Bodetabek)
  for (const sec of r.sec.filter((s) => ['Keberangkatan', 'Perjalanan', 'Kedatangan'].includes(s.h))) {
    for (const it of sec.items) {
      const row = it.code ? rowBy(it.bid, it.code, it.ti) : null;
      const base = { g: 'Transportasi', bid: it.bid, ti: it.ti, code: it.code, label: plain(it.title) };
      if (!row) { add({ ...base, n: null, qty: 0, vol: 'Tidak tercantum di tabel; mengacu harga riil/pasar', missing: true }); continue; }
      if (it.bid === 'L2-6') {
        if (hasTiket) { alt.push(plain(it.title)); continue; }
        hasTiket = true;
        for (const p of people) {
          const bis = state.kelas[p.k] === 'bis';
          add({ ...base, label: `${plain(it.title)} · ${bis ? 'Bisnis' : 'Ekonomi'}`, sub: p.n, n: row.n[bis ? 3 : 4], qty: p.c, vol: `${p.c} orang`, per: p.k });
        }
      } else if (it.bid === 'L2-5') {
        add({ ...base, n: row.n[3], qty: 2 * total, vol: `2 kali × ${total} orang`, perAll: 2 });
      } else if (it.bid === 'L2-2' || it.bid === 'L2-3') {
        add({ ...base, n: row.n[4], qty: 2 * total, vol: `2 kali (PP) × ${total} orang`, perAll: 2 });
      }
    }
  }
  // Selama di tujuan
  const tUH = S.butir['L1-25'].tables[0];
  const rUH = tUH.rows.find((x) => x.p === D.prov);
  const vUH = valueCols(tUH);
  const uhCol = state.jenis === 'diklat' ? vUH[2] : vUH[0];
  add({ g: 'Selama di tujuan', bid: 'L1-25', ti: 0, code: rUH?.c, label: `Uang harian · ${S.prov[D.prov].nama}${state.jenis === 'diklat' ? ' (diklat)' : ''}`, n: rUH ? rUH.n[uhCol] : null, qty: state.hari * total, vol: `${state.hari} hari × ${total} orang`, perAll: state.hari, missing: !rUH });
  const tH = S.butir['L1-27'].tables[0];
  const rH = tH.rows.find((x) => x.p === D.prov);
  const vH = valueCols(tH);
  if (state.malam > 0) {
    for (const p of people) add({ g: 'Selama di tujuan', bid: 'L1-27', ti: 0, code: rH?.c, label: `Penginapan · ${S.prov[D.prov].nama}`, sub: p.n, n: rH ? rH.n[vH[p.h]] : null, qty: state.malam * p.c, vol: `${state.malam} malam × ${p.c} orang`, per: p.k, perQty: state.malam, missing: !rH });
  }
  const tRep = S.butir['L1-25'].tables[1];
  const repRows = tRep.rows.filter((x) => x.v);
  for (const p of people.filter((x) => x.rep != null)) {
    const rr = repRows[p.rep];
    if (rr) add({ g: 'Selama di tujuan', bid: 'L1-25', ti: 1, code: rr.c, label: 'Uang representasi', sub: p.n, n: rr.n[valueCols(tRep)[0]], qty: state.hari * p.c, vol: `${state.hari} hari × ${p.c} orang`, per: p.k, perQty: state.hari });
  }
  // Per orang per tingkat
  const perPerson = people.map((p) => {
    let s = 0;
    for (const l of lines) {
      if (l.unit == null) continue;
      if (l.perAll) s += l.unit * l.perAll;
      else if (l.per === p.k) s += l.unit * (l.perQty || 1);
    }
    return { ...p, sum: s };
  });
  const grand = lines.reduce((a, l) => a + (l.amount || 0), 0);
  const effOn = lines.some((l) => effPct(l.t) < 100);
  return { ready: true, O, D, r, lines, people, total, perPerson, grand, alt, hasTiket, effOn, missing: lines.filter((l) => l.missing) };
}

const stepper = (id, val, min, max, label) => `<div class="stp" data-stp="${id}" data-min="${min}" data-max="${max}"><button type="button" data-d="-1" aria-label="Kurangi ${esc(label)}"${val <= min ? ' disabled' : ''}>−</button><output aria-live="polite">${val}</output><button type="button" data-d="1" aria-label="Tambah ${esc(label)}"${val >= max ? ' disabled' : ''}>+</button></div>`;

export function formHtml(routeForm) {
  const seg = (name, opts, cur) => `<div class="kp-seg" role="radiogroup">${opts.map((o) => `<button type="button" role="radio" aria-checked="${o.v === cur}" class="${o.v === cur ? 'on' : ''}" data-${name}="${o.v}"${o.soon ? ' disabled' : ''}>${esc(o.t)}${o.soon ? ' <em>Segera</em>' : ''}</button>`).join('')}</div>`;
  return `<div class="card card-pad kp-form">
    <div class="kp-step"><h2 class="kp-h"><span class="step">1</span>Tujuan surat tugas</h2>
      ${seg('lingkup', [{ v: 'dn', t: 'Dalam negeri, luar kota' }, { v: 'dk', t: 'Dalam kota', soon: true }, { v: 'ln', t: 'Luar negeri', soon: true }], 'dn')}
      ${routeForm(KP.dari, KP.ke)}
      <div class="kp-row"><span class="kp-lbl">Uang harian</span>${seg('jenis', [{ v: 'lk', t: 'Luar kota' }, { v: 'diklat', t: 'Diklat' }], KP.jenis)}</div>
    </div>
    <div class="kp-step"><h2 class="kp-h"><span class="step">2</span>Lama perjalanan</h2>
      <div class="kp-row"><span class="kp-lbl">Hari</span>${stepper('hari', KP.hari, 1, 60, 'hari')}</div>
      <div class="kp-row"><span class="kp-lbl">Malam menginap ${tip('Bawaan jumlah hari dikurangi satu. Bisa diubah dari 0 sampai sama dengan jumlah hari.')}</span>${stepper('malam', KP.malam, 0, KP.hari, 'malam')}</div>
    </div>
    <div class="kp-step"><h2 class="kp-h"><span class="step">3</span>Pelaksana</h2>
      <div class="kp-people">${TINGKAT.map((t) => `<div class="kp-p">
        <span class="kp-pn">${esc(t.n)}</span>
        <select class="sel kp-kelas" data-kelas="${t.k}" aria-label="Kelas tiket ${esc(t.n)}"><option value="eko"${KP.kelas[t.k] === 'eko' ? ' selected' : ''}>Ekonomi</option><option value="bis"${KP.kelas[t.k] === 'bis' ? ' selected' : ''}>Bisnis</option></select>
        ${stepper('org:' + t.k, KP.org[t.k], 0, 99, 'pelaksana ' + t.n)}
      </div>`).join('')}</div>
      <div class="muted small kp-note">Kelas tiket dipilih per tingkat dan hanya dipakai bila rutenya memakai tiket pesawat.</div>
    </div>
  </div>`;
}

const sifatChip = (s) => `<span class="chip ${s === 'BT' ? 'bt' : 'dl'}">${s === 'BT' ? 'Batas Tertinggi' : 'Dapat Dilampaui'}</span>`;

export function resultHtml(res, effNotice) {
  if (!res.ready) return `<div class="empty small">Pilih kota tujuan untuk menghitung perkiraan biaya.</div>`;
  if (res.dalamKota) return `<div class="callout">${ic('clock')}<div><b>Perjalanan dalam kota segera hadir.</b> Asal dan tujuan berada di kabupaten/kota yang sama. Untuk sekarang, lihat satuan biayanya di <a href="#/rute?dari=${encodeURIComponent(KP.dari)}&ke=${encodeURIComponent(KP.ke)}">Buat Perjalanan</a>.</div></div>`;
  if (!res.total) return `<div class="empty small">Tambahkan minimal satu pelaksana di langkah 3.</div>`;
  const groups = ['Transportasi', 'Selama di tujuan'];
  const rows = groups.map((g) => {
    const ls = res.lines.filter((l) => l.g === g);
    if (!ls.length) return '';
    return `<tr class="grp"><td colspan="4">${g}</td></tr>` + ls.map((l) => `<tr${l.missing ? ' class="miss"' : ''}>
      <td><div class="kp-k">${esc(l.label)}</div>${l.sub ? `<div class="kp-sub">${esc(l.sub)}</div>` : ''}<div class="kp-meta">${sifatChip(l.sifat)}<a class="chip ref" href="${l.ref.href}">${esc(l.ref.label)}</a></div></td>
      <td class="n" data-l="Satuan biaya">${l.n != null ? money(l.t, l.n, l.t.cur) : '<span class="na">Tidak tercantum</span>'}</td>
      <td class="vol" data-l="Volume">${esc(l.vol)}</td>
      <td class="n tot" data-l="Jumlah">${l.amount != null ? fmt(l.amount) : '–'}</td>
    </tr>`).join('');
  }).join('');
  const sum = `${esc(res.O.label)} – ${esc(res.D.label)} · ${KP.hari} hari ${KP.malam} malam · ${res.total} orang`;
  const per = res.perPerson.map((p) => `<div class="kp-pp"><span>${esc(p.n)}${p.c > 1 ? ` <small>× ${p.c}</small>` : ''}</span><b>${fmt(p.sum)}</b></div>`).join('');
  const check = res.lines.filter((l) => !l.missing).map((l) => `<li><b>${esc(l.label)}</b>${l.sub ? ` · ${esc(l.sub)}` : ''}: ${esc(l.vol)}</li>`).join('');
  const notes = [];
  if (res.alt.length) notes.push(`Rute tiket lain yang juga tercantum: ${res.alt.map(esc).join('; ')}. Perhitungan memakai rute pertama.`);
  if (res.missing.length) notes.push('Komponen yang tidak tercantum di tabel tidak ikut dijumlahkan.');
  return `${effNotice()}
  <div class="card kp-res">
    <div class="kp-res-h"><div><div class="kp-title">Perkiraan biaya perjalanan dinas</div><div class="muted small">${sum}</div></div>
      <div class="kp-actions"><button type="button" class="btn" id="kpPdf">${ic('download')} Unduh PDF</button><button type="button" class="btn" id="kpShare" hidden>${ic('share-2')} Bagikan PDF</button></div></div>
    <div class="tbl-wrap kp-tbl"><table class="t kp-t">
      <thead><tr><th>Komponen</th><th class="n">Satuan biaya</th><th>Volume</th><th class="n">Jumlah</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="3">Perkiraan total</td><td class="n">${fmt(res.grand)}</td></tr></tfoot>
    </table></div>
    <div class="kp-pps"><div class="kp-pps-h">Per orang</div>${per}</div>
    <div class="kp-foot muted small">Satuan biaya mengikuti SBM TA ${Y.y} (${esc(Y.src)})${res.effOn ? ', dengan persentase dibayar yang sedang aktif' : ''}. Volume taksi dan transport darat dihitung 2 kali (berangkat dan pulang). Tiket dan taksi bersifat dapat dilampaui, jadi angkanya acuan, bukan batas. ${notes.join(' ')}</div>
  </div>
  ${fold('Daftar periksa komponen', `<ul class="kp-check">${check}</ul>`)}`;
}

// ---------- PDF ----------
let pdfLib = null;
function loadScript(src) {
  return new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
}
async function lib() {
  if (!pdfLib) pdfLib = loadScript('vendor/jspdf.umd.min.js').then(() => loadScript('vendor/jspdf.plugin.autotable.min.js'));
  await pdfLib;
  return window.jspdf.jsPDF;
}
const fmtPdf = (n) => (n == null ? '-' : fmt(n));
export async function buildPdf(res) {
  const jsPDF = await lib();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const navy = [34, 45, 99];
  doc.setFillColor(...navy); doc.rect(0, 0, W, 4, 'F');
  doc.setFillColor(244, 190, 22); doc.rect(0, 4, W, 1.2, 'F');
  doc.setTextColor(...navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text('Perkiraan Biaya Perjalanan Dinas', 14, 16);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(80, 86, 110);
  doc.text(`Standar Biaya Masukan TA ${Y.y} (${Y.src})`, 14, 21.5);
  const info = [
    ['Asal', plain(res.O.label)], ['Tujuan', `${plain(res.D.label)} (${S.prov[res.D.prov].nama})`],
    ['Lama', `${KP.hari} hari, ${KP.malam} malam`], ['Uang harian', KP.jenis === 'diklat' ? 'Diklat' : 'Luar kota'],
    ['Pelaksana', res.people.map((p) => `${p.n} (${p.c})`).join('; ')],
  ];
  doc.autoTable({ startY: 26, body: info, theme: 'plain', styles: { fontSize: 9.5, cellPadding: 1.2, textColor: [30, 34, 52] }, columnStyles: { 0: { cellWidth: 28, fontStyle: 'bold' } }, margin: { left: 14, right: 14 } });
  const body = [];
  for (const g of ['Transportasi', 'Selama di tujuan']) {
    const ls = res.lines.filter((l) => l.g === g);
    if (!ls.length) continue;
    body.push([{ content: g, colSpan: 5, styles: { fontStyle: 'bold', fillColor: [238, 241, 250], textColor: navy } }]);
    for (const l of ls) {
      const p = effPct(l.t);
      const unit = l.n == null ? 'Tidak tercantum' : p < 100 ? `${fmt(l.unit)}\n(${pctTxt(p)} dari ${fmt(l.n)})` : fmt(l.n);
      body.push([`${plain(l.label)}${l.sub ? '\n' + l.sub : ''}`, l.ref.label, unit, l.vol, fmtPdf(l.amount)]);
    }
  }
  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 4,
    head: [['Komponen', 'Rujukan', 'Satuan biaya', 'Volume', 'Jumlah']],
    body,
    foot: [[{ content: 'Perkiraan total', colSpan: 4 }, fmt(res.grand)]],
    theme: 'grid',
    styles: { fontSize: 8.6, cellPadding: 1.8, lineColor: [215, 219, 232], lineWidth: 0.2, textColor: [30, 34, 52], valign: 'top' },
    headStyles: { fillColor: navy, textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [255, 246, 214], textColor: navy, fontStyle: 'bold', fontSize: 9.5 },
    columnStyles: { 1: { cellWidth: 30 }, 2: { halign: 'right', cellWidth: 36 }, 3: { cellWidth: 34 }, 4: { halign: 'right', cellWidth: 30 } },
    didParseCell: (d) => { if (d.section === 'foot' && d.column.index === 4) d.cell.styles.halign = 'right'; if (d.section === 'head' && (d.column.index === 2 || d.column.index === 4)) d.cell.styles.halign = 'right'; },
    margin: { left: 14, right: 14 },
  });
  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 4,
    head: [['Per orang', 'Jumlah']],
    body: res.perPerson.map((p) => [`${p.n}${p.c > 1 ? ` (x ${p.c})` : ''}`, fmt(p.sum)]),
    theme: 'grid', styles: { fontSize: 8.6, cellPadding: 1.8, lineColor: [215, 219, 232], lineWidth: 0.2 },
    headStyles: { fillColor: [238, 241, 250], textColor: navy, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right', cellWidth: 34 } }, margin: { left: 14, right: 14 },
  });
  const notes = [
    'Satuan biaya mengikuti SBM; volume taksi dan transport darat dihitung 2 kali (berangkat dan pulang).',
    'Tiket dan taksi bersifat dapat dilampaui (acuan); uang harian, penginapan, dan representasi bersifat batas tertinggi.',
  ];
  if (res.effOn) notes.push('Sebagian satuan biaya memakai persentase dibayar (simulasi efisiensi); besaran SBM resmi tercantum di kolom Satuan biaya.');
  if (res.missing.length) notes.push('Komponen yang tidak tercantum di tabel SBM tidak ikut dijumlahkan.');
  let y = doc.lastAutoTable.finalY + 6;
  doc.setFontSize(8); doc.setTextColor(90, 96, 120);
  for (const n of notes) { const t = doc.splitTextToSize('- ' + n, W - 28); if (y + t.length * 3.6 > 285) { doc.addPage(); y = 16; } doc.text(t, 14, y); y += t.length * 3.6 + 0.8; }
  const pages = doc.getNumberOfPages();
  const stamp = new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(120, 126, 150);
    doc.text(`Perkiraan dari aplikasi bantu baca SBM, bukan dokumen resmi. Dibuat ${stamp}.`, 14, 291);
    doc.text(`${i}/${pages}`, W - 14, 291, { align: 'right' });
  }
  const name = `Perkiraan-Perjadin-${plain(res.D.label).replace(/[^\w]+/g, '-')}-${KP.hari}hari-TA${Y.y}.pdf`.replace(/-+/g, '-');
  return { blob: doc.output('blob'), name };
}
