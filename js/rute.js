// Fitur Rute Perjadin: dari kota X ke kota Y → satuan biaya yang relevan
import { S, Y, norm, esc, fmt, valueCols, shortCol, rapatTiers, tip } from './store.js';

export const W = { data: null, byId: {}, list: [], ticketByReg: {} };

export async function loadWilayah() {
  const res = await fetch('data/wilayah.json', { cache: 'no-cache' }).catch(() => fetch('data/wilayah.json'));
  const d = await res.json();
  W.data = d;
  for (const p of d.places) W.byId[p.id] = p;
  for (const [city, reg] of Object.entries(d.ticket)) if (reg !== 'DKI') W.ticketByReg[reg] = city;
  buildPlaceList();
}

function titleCity(c) { return c.toLowerCase().replace(/(^|[\s-])\S/g, (m) => m.toUpperCase()); }

function buildPlaceList() {
  const L = [];
  L.push({ id: 'jakarta', n: 'Jakarta', sub: 'DKI Jakarta · seluruh kota administrasi', t: 'DKI', p: 'dki', air: true, s: norm('jakarta dki jkt ibukota'), rank: 0 });
  for (const p of S.provList) {
    if (p.id === 'dki') continue;
    L.push({ id: 'p-' + p.id, n: p.nama, sub: `Provinsi · dihitung di ibu kota (${capName(p.id)})`, t: 'Provinsi', p: p.id, s: norm([p.nama, ...p.alias, p.nama.replace('Sumatra', 'Sumatera')].join(' ')), rank: 1 });
  }
  for (const r of W.data.places) {
    const air = !!W.ticketByReg[r.id];
    L.push({
      id: r.id, n: r.n, sub: `${r.t === 'kota' ? 'Kota' : 'Kabupaten'} · ${S.prov[r.p].nama}`, t: r.dki ? 'DKI' : r.t === 'kota' ? 'Kota' : 'Kab.',
      p: r.p, air, s: norm([r.n.replace(/^Kab\. /, ''), r.n, ...(r.a || []), S.prov[r.p].nama].join(' ')), rank: air ? 2 : r.t === 'kota' ? 3 : 4,
    });
  }
  W.list = L;
}

export function capName(pid) {
  if (W.data.capitalLabel[pid]) return W.data.capitalLabel[pid];
  const c = W.data.capital[pid];
  if (!c) return 'Jakarta';
  return W.byId[c].n.replace(/^Kab\. /, '').replace(/^Kota /, '');
}

// Saran tempat untuk kolom isian
export function suggest(q, limit = 8) {
  const n = norm(q);
  if (!n) return [];
  const toks = n.split(' ');
  const out = [];
  for (const it of W.list) {
    const words = it.s.split(' ');
    if (!toks.every((t) => words.some((w) => w.startsWith(t)))) continue;
    const nameN = norm(it.n.replace(/^Kab\. /, ''));
    let score = it.rank;
    if (nameN === n) score -= 10;
    else if (nameN.startsWith(n)) score -= 5;
    out.push({ it, score });
  }
  out.sort((a, b) => a.score - b.score || a.it.n.localeCompare(b.it.n, 'id'));
  return out.slice(0, limit).map((x) => x.it);
}

export function placeLabel(id) {
  const it = W.list.find((x) => x.id === id);
  return it ? it.n : '';
}

// Cocokkan teks bebas ke satu tempat (untuk Cari: "jakarta ke bojonegoro")
export function matchPlace(text) {
  const s = suggest(text, 1);
  return s[0] || null;
}

export function resolve(id) {
  if (!id || id === 'jakarta' || id === 'p-dki') return { id: 'jakarta', label: 'Jakarta', prov: 'dki', reg: null, dki: true, kind: 'dki' };
  if (id.startsWith('p-')) {
    const pid = id.slice(2);
    if (!S.prov[pid]) return null;
    const reg = W.byId[W.data.capital[pid]];
    return { id, label: S.prov[pid].nama, prov: pid, reg, dki: false, kind: 'prov', viaCapital: true };
  }
  const reg = W.byId[id];
  if (!reg) return null;
  if (reg.dki) return { id, label: reg.n, prov: 'dki', reg, dki: true, kind: 'dki' };
  return { id, label: reg.n, prov: reg.p, reg, dki: false, kind: 'reg' };
}

function ticketCities(E) {
  if (E.dki) return ['JAKARTA'];
  if (E.reg && W.ticketByReg[E.reg.id]) return [W.ticketByReg[E.reg.id]];
  const cap = W.data.capital[E.prov];
  return Object.entries(W.data.ticket).filter(([, reg]) => reg !== 'DKI' && W.byId[reg]?.p === E.prov)
    .sort((a, b) => (b[1] === cap) - (a[1] === cap)).map(([c]) => c);
}

const isCapital = (E) => E.kind === 'prov' || (E.reg && E.reg.cap);

function rowBy(bid, code, ti = 0) { return S.butir[bid].tables[ti].rows.find((r) => r.c === code); }

/* Komponen: { title, sub, vals:[{k, v, hl}], bid, ti, code, note, sifat } */
function comp(bid, ti, row, title, sub, opt = {}) {
  const b = S.butir[bid];
  const t = b.tables[ti];
  const vc = opt.cols || valueCols(t);
  return {
    title, sub, bid, ti, code: row?.c, sifat: b.sifat, note: opt.note,
    vals: row ? vc.map((i) => ({ k: opt.labels?.[i] || shortCol(t.cols[i]), v: fmt(row.n[i], t.cur), hl: opt.hl?.includes(i) })) : [],
    missing: !row ? (opt.missing || `Tidak tercantum dalam tabel ${Y.srcKind}.`) : null,
  };
}

export function computeRoute(O, D) {
  const sec = [];
  const notes = [];
  const sameKab = (O.dki && D.dki) || (O.reg && D.reg && O.reg.id === D.reg.id);
  const sameProv = O.prov === D.prov;
  const pO = S.prov[O.prov], pD = S.prov[D.prov];
  if (O.kind === 'prov') notes.push(`Asal berupa provinsi, dihitung dari ibu kota ${capName(O.prov)}.`);
  if (D.kind === 'prov') notes.push(`Tujuan berupa provinsi, dihitung di ibu kota ${capName(D.prov)}.`);

  // Uang harian
  const tUH = S.butir['L1-25'].tables[0];
  const uh = (pid, hlIdx) => {
    const r = tUH.rows.find((x) => x.p === pid);
    return comp('L1-25', 0, r, `Uang harian · ${S.prov[pid].nama}`, 'Per orang per hari menurut provinsi tujuan. Bila transpor lokal dibayar riil, uang harian 60%.', { hl: [hlIdx] });
  };
  const vUH = valueCols(tUH); // [luar kota, dalam kota >8 jam, diklat]
  const tRep = S.butir['L1-25'].tables[1];
  const rep = (colIdx) => ({
    title: 'Uang representasi', sub: 'Hanya pejabat negara/wamen, eselon I, dan eselon II pada perjalanan dinas jabatan. Berlaku nasional.',
    bid: 'L1-25', ti: 1, code: '25.2', sifat: 'BT',
    vals: tRep.rows.filter((r) => r.v).map((r) => ({ k: r.v[1], v: fmt(r.n[colIdx]) })),
  });

  if (sameKab) {
    const tDK = S.butir['L2-4'].tables[0];
    sec.push({
      h: 'Perjalanan dalam satu kabupaten/kota', items: [
        comp('L2-4', 0, tDK.rows[0], 'Transpor kegiatan dalam kota (PP)', 'Untuk kegiatan di luar kantor dalam satu kabupaten/kota, tanpa kendaraan dinas; tidak untuk kegiatan di kompleks perkantoran yang sama.' + (O.dki ? ' DKI Jakarta dihitung satu kabupaten/kota.' : '')),
      ],
    });
    sec.push({ h: 'Uang harian & representasi', items: [uh(O.prov, vUH[1]), rep(valueCols(tRep)[1])] });
    notes.push('Asal dan tujuan berada di kabupaten/kota yang sama. Kolom "Dalam Kota >8 Jam" disorot; jenis perjalanan dinas ditentukan menurut PMK Perjalanan Dinas.');
    return { sec, notes, kind: 'Dalam kota', sameKab, sameProv };
  }

  // 1) Keberangkatan
  const tTx = S.butir['L2-5'].tables[0];
  const taksi = (pid, where) => {
    const r = tTx.rows.find((x) => x.p === pid);
    return comp('L2-5', 0, r, `Taksi di ${where} · ${S.prov[pid].nama}`, 'Sekali jalan ke/dari bandara, stasiun, terminal, atau pelabuhan. Lumpsum; dapat riil bila dari/ke kantor dan bukan kendaraan pribadi.', { missing: `${S.prov[pid].nama} tidak tercantum dalam tabel taksi KMK (Lampiran II angka 5).` });
  };
  const bodeLeg = (O.dki && D.reg?.bode) ? D.reg.bode : (D.dki && O.reg?.bode) ? O.reg.bode : null;
  const tDar = S.butir['L2-2'].tables[0];
  const darRow = (E) => (E.reg?.darat || []).map((x) => ({ r: rowBy('L2-2', x.c), note: x.note }));

  const dep = [];
  const leg = [];
  const arr = [];

  if (bodeLeg) {
    const r = rowBy('L2-3', bodeLeg);
    leg.push(comp('L2-3', 0, r, `Transport Jakarta ⇄ ${r.v[2]}`, 'Sekali jalan. Lumpsum; dapat riil bila dari/ke kantor dan bukan kendaraan pribadi.', { labels: { 4: 'Sekali jalan' } }));
  } else if (sameProv) {
    // dalam provinsi: transport darat dari/ke ibu kota
    if (isCapital(O) && darRow(D).length) {
      for (const x of darRow(D)) leg.push(comp('L2-2', 0, x.r, `Transport darat ${x.r.v[1]} → ${x.r.v[2]}`, 'Sekali jalan dari ibu kota provinsi.', { labels: { 4: 'Sekali jalan' }, note: x.note }));
    } else if (isCapital(D) && darRow(O).length) {
      for (const x of darRow(O)) leg.push(comp('L2-2', 0, x.r, `Transport darat ${x.r.v[2]} → ${x.r.v[1]}`, `Sekali jalan (${Y.srcKind}: dari ibu kota provinsi atau sebaliknya).`, { labels: { 4: 'Sekali jalan' }, note: x.note }));
    } else {
      leg.push({ title: 'Transport darat', sub: '', bid: 'L2-2', ti: 0, sifat: 'DL', vals: [], missing: `Tabel ${Y.srcKind} hanya memuat rute dari ibu kota provinsi ke kabupaten/kota. Rute yang belum tercantum mengacu pada harga pasar (at cost).` });
    }
    // tiket dalam provinsi (mis. Jayapura–Biak), bila ada
    const tk = ticketRoutes(O, D);
    leg.push(...tk.items);
  } else {
    // antarprovinsi
    if (!O.dki && O.reg && !W.ticketByReg[O.reg.id] && !isCapital(O)) {
      for (const x of darRow(O)) dep.push(comp('L2-2', 0, x.r, `Transport darat ${x.r.v[2]} → ${x.r.v[1]}`, `Menuju ibu kota provinsi (${Y.srcKind}: dari ibu kota provinsi atau sebaliknya).`, { labels: { 4: 'Sekali jalan' }, note: x.note }));
    }
    const tk = ticketRoutes(O, D);
    leg.push(...tk.items);
    if (!tk.found) leg.push({ title: 'Tiket pesawat (PP)', sub: '', bid: 'L2-6', ti: 0, sifat: 'DL', vals: [], missing: `Tidak ada rute tiket pesawat yang tercantum antara ${tk.oc.map(titleCity).join('/') || pO.nama} dan ${tk.dc.map(titleCity).join('/') || pD.nama} dalam tabel KMK (Lampiran II angka 6).` });
    if (D.reg && !D.dki && !W.ticketByReg[D.reg.id] && !isCapital(D)) {
      for (const x of darRow(D)) arr.push(comp('L2-2', 0, x.r, `Transport darat ${x.r.v[1]} → ${x.r.v[2]}`, 'Dari ibu kota provinsi ke kabupaten/kota tujuan.', { labels: { 4: 'Sekali jalan' }, note: x.note }));
      if (!darRow(D).length) arr.push({ title: `Transport darat ke ${D.label}`, sub: '', bid: 'L2-2', ti: 0, sifat: 'DL', vals: [], missing: 'Rute dari ibu kota provinsi ke kabupaten/kota ini tidak tercantum. Mengacu pada harga pasar (at cost).' });
    }
  }
  if (!bodeLeg) {
    dep.unshift(taksi(O.prov, 'kota asal'));
    arr.unshift(taksi(D.prov, 'kota tujuan'));
  }

  sec.push({ h: 'Keberangkatan', items: dep });
  sec.push({ h: 'Perjalanan', items: leg });
  if (arr.length) sec.push({ h: 'Kedatangan', items: arr });

  // 4) Selama di tujuan
  const tH = S.butir['L1-27'].tables[0];
  const rH = tH.rows.find((x) => x.p === D.prov);
  sec.push({
    h: 'Selama di tujuan', items: [
      uh(D.prov, vUH[0]),
      comp('L1-27', 0, rH, `Penginapan · ${pD.nama}`, 'Per orang per hari menurut tingkat jabatan, dengan bukti pengeluaran yang sah.'),
      rep(valueCols(tRep)[0]),
    ],
  });

  // 5) Bila ada rapat di luar kantor
  const tiers = rapatTiers();
  const tR = S.butir['L1-29'].tables[0];
  const vcR = valueCols(tR);
  sec.push({
    h: 'Bila mengikuti rapat di luar kantor', table: {
      cols: ['Tingkat peserta', ...vcR.map((i) => tR.cols[i])],
      rows: tiers.map((tr) => { const r = tr.rows.find((x) => x.p === D.prov); return [tr.name, ...vcR.map((i) => (r ? fmt(r.n[i]) : '–'))]; }),
      bid: 'L1-29', code: tiers[2].rows.find((x) => x.p === D.prov)?.c,
      note: `Paket per orang di ${pD.nama}. Uang harian rapat ${fmt(S.butir['L1-29'].tables[1].rows.find((r) => r.v).n[3])}/OH hanya untuk fullboard.`,
    },
  });

  if (bodeLeg) notes.push('Rute Jakarta–Bodetabek memakai satuan biaya transport Jakarta ke kabupaten/kota sekitar. Jenis perjalanan dinas (dalam kota/luar kota) ditentukan menurut PMK Perjalanan Dinas.');
  return { sec, notes, kind: sameProv ? 'Dalam provinsi' : 'Antarprovinsi', sameKab, sameProv };
}

function ticketRoutes(O, D) {
  const oc = ticketCities(O), dc = ticketCities(D);
  const t = S.butir['L2-6'].tables[0];
  const U = (x) => x.toUpperCase();
  const rows = t.rows.filter((r) => r.v && ((oc.includes(U(r.v[1])) && dc.includes(U(r.v[2]))) || (dc.includes(U(r.v[1])) && oc.includes(U(r.v[2])))));
  rows.sort((a, b) => Math.min(...[a.v[1], a.v[2]].map((c) => { const i = dc.indexOf(U(c)); return i < 0 ? 99 : i; })) - Math.min(...[b.v[1], b.v[2]].map((c) => { const i = dc.indexOf(U(c)); return i < 0 ? 99 : i; })));
  const items = rows.map((r) => {
    const fwd = oc.includes(U(r.v[1]));
    const a = fwd ? r.v[1] : r.v[2], b = fwd ? r.v[2] : r.v[1];
    return comp('L2-6', 0, r, `Tiket pesawat ${titleCity(a)} ⇄ ${titleCity(b)}`, 'Pergi pulang (PP). Termasuk asuransi; tidak termasuk airport tax, bagasi, retribusi. Dibayar riil.');
  });
  return { items, found: rows.length > 0, oc, dc };
}

/* ---------- Tampilan ---------- */
function compHtml(c) {
  const ref = `<a class="chip ref" href="#/b/${c.bid}?t=${c.ti}${c.code ? '&r=' + encodeURIComponent(c.code) : ''}">${S.butir[c.bid].lamp === 1 ? 'Lamp. I' : 'Lamp. II'} angka ${(c.code && rowBy(c.bid, c.code, c.ti)?.v?.[0]) || c.code || S.butir[c.bid].no}</a>`;
  const sif = `<span class="chip ${c.sifat === 'BT' ? 'bt' : 'dl'}">${c.sifat === 'BT' ? 'Batas Tertinggi' : 'Dapat Dilampaui'}</span>`;
  const vals = c.missing
    ? `<div class="callout warn" style="margin-top:8px"><div>${esc(c.missing)}</div></div>`
    : `<div class="kv" style="margin-top:10px">${c.vals.map((v) => `<div${v.hl ? ' class="hlv"' : ''}><div class="k">${esc(v.k)}</div><div class="v ${c.vals.length > 2 ? 'sm' : ''}">${v.v}</div></div>`).join('')}</div>`;
  const info = [c.sub, c.note].filter(Boolean).map(esc).join('<br><br>');
  return `<div class="rcomp"><div class="rhead"><div class="t">${esc(c.title)} ${tip(info)}</div><div class="chips">${sif}${ref}</div></div>${vals}</div>`;
}

export function routeHtml(O, D) {
  const r = computeRoute(O, D);
  const foot = `Angka per satuan sesuai ${Y.src}. Jumlah hari, malam, dan frekuensi perjalanan mengikuti surat tugas dan PMK Perjalanan Dinas. Kota tiket ditentukan dari kota bandara yang ada di tabel ${Y.srcKind} pada provinsi yang sama (ibu kota didahulukan).`;
  const head = `<div class="route-sum card card-pad"><div class="route-line"><span class="rp">${esc(O.label)}</span><span class="ra" aria-hidden="true">→</span><span class="rp">${esc(D.label)}</span>${tip([...r.notes.map(esc), foot].join('<br><br>'))}</div>
    <div class="muted small">${esc(S.prov[O.prov].nama)} → ${esc(S.prov[D.prov].nama)} · ${esc(r.kind)}</div></div>`;
  let n = 0;
  const secs = r.sec.filter((s) => (s.items && s.items.length) || s.table).map((s) => {
    n++;
    if (s.table) {
      return `<section class="rsec"><h2 class="sec"><span class="step">${n}</span>${esc(s.h)} ${tip(esc(s.table.note))}</h2><div class="card card-pad"><div style="overflow:auto"><table class="mini"><thead><tr>${s.table.cols.map((c, i) => `<th${i ? ' class="n"' : ''}>${esc(c)}</th>`).join('')}</tr></thead><tbody>${s.table.rows.map((row) => `<tr>${row.map((c, i) => `<td${i ? ' class="n"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
        <div class="chips" style="margin-top:10px"><span class="chip bt">Batas Tertinggi</span><a class="chip ref" href="#/b/L1-29?t=0${s.table.code ? '&r=' + encodeURIComponent(s.table.code) : ''}">Lamp. I angka 29</a></div></div></section>`;
    }
    return `<section class="rsec"><h2 class="sec"><span class="step">${n}</span>${esc(s.h)}</h2><div class="card rlist">${s.items.map(compHtml).join('')}</div></section>`;
  }).join('');
  return head + secs;
}

const HINT_NAMES = ['Jawa Timur', 'Kota Surabaya', 'Kota Makassar', 'Kota Medan', 'Kota Denpasar', 'Kota Bandung', 'Kota Bekasi', 'Kab. Mimika'];
export function routeHints() {
  return HINT_NAMES.map((n) => W.list.find((x) => x.n === n)).filter(Boolean);
}
