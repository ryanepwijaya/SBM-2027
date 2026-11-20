// Dinas Pindah: perkiraan biaya perjalanan dinas pindah dalam negeri dan luar negeri.
// DN: transportasi sekali jalan pegawai + keluarga (mesin SBM Perjalanan), uang harian, pengepakan dan angkutan barang (Lamp. I angka 24).
// LN: tiket pindah sekali jalan Jakarta ⇄ perwakilan (Lamp. I angka 28, US$) untuk pegawai + keluarga.
// Volume barang (m³) dan jarak (km) diisi pengguna; batas volume dan ketentuan lain di PMK Perjalanan Dinas tidak diterapkan.
import { S, Y, esc, fmt, store, tip, valueCols } from './store.js';
import { resolve, computeRoute, rowBy, placeLabel } from './rute.js';
import { ic } from './icons.js';
import { TINGKAT, plain, adder, finish, resTable, buildPdf, kursTxt } from './hitung.js';

const KEY = 'pindah';
const DEF = () => ({ lingkup: 'dn', asal: 'jakarta', ke: '', tk: 'e4', kelas: 'eko', kel: 0, tiket: 'half', hari: 1, moda: 'truk', m3: '', km: '', per: '', arah: 'out', kln: 'pub' });
const MODA = [['kereta', 'Kereta api'], ['truk', 'Truk'], ['laut', 'Angkutan laut/sungai']];
const KLN = [['pub', 'Published'], ['bus', 'Business'], ['first', 'First']];
const num = (s) => { const v = Number(String(s ?? '').replace(/\./g, '').replace(',', '.')); return Number.isFinite(v) && v > 0 ? v : 0; };
const dec = (n) => String(n).replace('.', ',');

function load() {
  const T = DEF();
  const d = store.get(KEY, null);
  if (d && typeof d === 'object') for (const k of Object.keys(T)) if (d[k] != null && typeof d[k] === typeof T[k]) T[k] = d[k];
  if (!TINGKAT.some((t) => t.k === T.tk)) T.tk = 'e4';
  return T;
}
const peopleOf = (T) => {
  const t = TINGKAT.find((x) => x.k === T.tk);
  const ps = [{ ...t, c: 1 }];
  if (T.kel > 0) ps.push({ k: 'kel', n: 'Anggota keluarga', h: t.h, rep: null, c: T.kel });
  return ps;
};
const pindahRows = () => {
  const t = S.butir['L1-24'].tables[0];
  const groups = [];
  for (const r of t.rows) { if (r.g) groups.push({ g: r.g, rows: [] }); else if (r.v && groups.length) groups[groups.length - 1].rows.push(r); }
  return { t, groups };
};
const perwakilanRows = () => S.butir['L1-28'].tables[0].rows.filter((r) => r.v);

function computeDN(T) {
  const O = resolve(T.asal), D = T.ke ? resolve(T.ke) : null;
  if (!O || !D) return { ready: false };
  const people = peopleOf(T);
  const total = people.reduce((a, p) => a + p.c, 0);
  const lines = [];
  const add = adder(lines);
  const alt = [], notes = [];
  const f = T.tiket === 'full' ? 1 : 0.5;
  let hasTiket = false;
  const r = computeRoute(O, D);
  const G = `Transportasi ${plain(O.label)} → ${plain(D.label)}`;
  if (r.sameKab) notes.push('Kota asal dan tujuan berada di kabupaten/kota yang sama; transportasi antarkota tidak dihitung.');
  else {
    for (const sec of r.sec.filter((s) => ['Keberangkatan', 'Perjalanan', 'Kedatangan'].includes(s.h))) {
      for (const it of sec.items) {
        const row = it.code ? rowBy(it.bid, it.code, it.ti) : null;
        const base = { g: G, sec: sec.h, cat: it.bid === 'L2-6' ? 'tiket' : it.bid === 'L2-5' ? 'taksi' : 'darat', bid: it.bid, ti: it.ti, code: it.code, label: plain(it.title) };
        if (!row) { add({ ...base, n: null, qty: 0, vol: 'Tidak tercantum di tabel; mengacu harga riil/pasar', missing: true }); continue; }
        if (it.bid === 'L2-6') {
          if (hasTiket) { alt.push(plain(it.title)); continue; }
          hasTiket = true;
          const bis = T.kelas === 'bis';
          for (const p of people) add({ ...base, label: `${plain(it.title)} · ${bis ? 'Bisnis' : 'Ekonomi'}`, sub: p.n, n: row.n[bis ? 3 : 4], qty: p.c * f, vol: `${f === 1 ? 'tarif PP penuh' : '½ tarif PP'} × ${p.c} orang`, per: p.k, perQty: f });
        } else if (it.bid === 'L2-5') add({ ...base, n: row.n[3], qty: total, vol: `1 kali × ${total} orang`, perAll: 1 });
        else if (it.bid === 'L2-2' || it.bid === 'L2-3') add({ ...base, n: row.n[4], qty: total, vol: `1 kali (sekali jalan) × ${total} orang`, perAll: 1 });
      }
    }
  }
  // Uang harian provinsi tujuan
  const tUH = S.butir['L1-25'].tables[0];
  const rUH = tUH.rows.find((x) => x.p === D.prov);
  if (T.hari > 0) add({ g: 'Uang harian', cat: 'uh', bid: 'L1-25', ti: 0, code: rUH?.c, label: `Uang harian · ${S.prov[D.prov].nama}`, n: rUH ? rUH.n[valueCols(tUH)[0]] : null, qty: T.hari * total, vol: `${T.hari} hari × ${total} orang`, perAll: T.hari, missing: !rUH });
  // Pengepakan dan angkutan barang
  const { groups } = pindahRows();
  const gi = MODA.findIndex((m) => m[0] === T.moda);
  const grp = groups[gi];
  const m3 = num(T.m3), km = num(T.km);
  const GB = `Pengepakan dan angkutan barang · ${MODA[gi][1]}`;
  if (grp && m3) {
    grp.rows.forEach((row, i) => {
      const unit = row.v[2];
      const base = { g: GB, cat: 'barang', bid: 'L1-24', ti: 0, code: row.c, label: row.v[1] };
      if (row.n[3] == null) { add({ ...base, label: `${row.v[1]}${/laut/i.test(row.v[1]) ? '' : ' (kereta api)'}`, n: null, qty: 0, vol: 'Sesuai tarif yang berlaku; tidak dijumlahkan', missing: true }); return; }
      if (/km/i.test(unit)) {
        if (!km) { add({ ...base, label: `${row.v[1]}${T.moda === 'laut' ? ' darat' : ''}`, n: row.n[3], qty: 0, vol: 'Isi jarak (km) untuk menghitung' }); return; }
        add({ ...base, label: `${row.v[1]}${T.moda === 'laut' ? ' darat' : ''}`, n: row.n[3], qty: km * m3, vol: `${dec(km)} km × ${dec(m3)} m³` });
      } else add({ ...base, n: row.n[3], qty: m3, vol: `${dec(m3)} m³` });
      void i;
    });
  }
  return finish({ lingkup: 'pindah', O, D, alt, hasTiket, notes, f, m3, km }, lines, people);
}

function computeLN(T, kurs) {
  const row = T.per ? perwakilanRows().find((r) => r.v[1] === T.per) : null;
  if (!row) return { ready: false };
  const people = peopleOf(T);
  const lines = [];
  const add = adder(lines);
  const ci = KLN.findIndex((k) => k[0] === T.kln);
  const col = (T.arah === 'out' ? 3 : 6) + ci;
  const dir = T.arah === 'out' ? `Jakarta → ${T.per}` : `${T.per} → Jakarta`;
  for (const p of people) add({ g: 'Tiket pindah luar negeri (sekali jalan)', cat: 'tiketln', bid: 'L1-28', ti: 0, code: row.c, label: `Tiket ${dir} · ${KLN[ci][1]}`, sub: p.n, n: row.n[col], qty: p.c, vol: `${p.c} orang`, per: p.k, missing: row.n[col] == null });
  return finish({ lingkup: 'pindahln', alt: [], hasTiket: true, notes: [], dir }, lines, people, kurs);
}

const seg = (name, opts, cur) => `<div class="kp-seg" role="radiogroup">${opts.map(([v, t]) => `<button type="button" role="radio" aria-checked="${v === cur}" class="${v === cur ? 'on' : ''}" data-${name}="${v}">${esc(t)}</button>`).join('')}</div>`;
const stp = (id, val, min, max, label) => `<div class="stp sm" data-stp="${id}" data-min="${min}" data-max="${max}"><button type="button" data-d="-1" aria-label="Kurangi ${esc(label)}"${val <= min ? ' disabled' : ''}>−</button><input class="stp-in" type="text" inputmode="numeric" maxlength="3" value="${val}" aria-label="${esc(label)}"><button type="button" data-d="1" aria-label="Tambah ${esc(label)}"${val >= max ? ' disabled' : ''}>+</button></div>`;

function formHtml(T, ui, kurs) {
  const tkSel = `<label class="kp-fld"><span>Tingkat pegawai</span><select class="sel" id="pdTk">${TINGKAT.map((t) => `<option value="${t.k}"${t.k === T.tk ? ' selected' : ''}>${esc(t.n)}</option>`).join('')}</select></label>
    <div class="kp-row"><span class="kp-lbl">Anggota keluarga ${tip('Jumlah anggota keluarga yang ikut pindah. Tarifnya mengikuti tingkat dan kelas pegawai.')}</span>${stp('kel', T.kel, 0, 20, 'Anggota keluarga')}</div>`;
  if (T.lingkup === 'ln') {
    const rows = perwakilanRows();
    return `<div class="card card-pad kp-form">
      <div class="kp-step"><h2 class="kp-h"><span class="step">1</span>Tujuan pindah<button type="button" class="btn sm danger kp-reset" id="pdReset">${ic('history')} Reset</button></h2>
        ${seg('lingkup', [['dn', 'Dalam negeri'], ['ln', 'Luar negeri']], T.lingkup)}
        <div class="kp-row"><span class="kp-lbl">Arah</span>${seg('arah', [['out', 'Jakarta → perwakilan'], ['in', 'Perwakilan → Jakarta']], T.arah)}</div>
        <label class="kp-fld"><span>Perwakilan</span><select class="sel" id="pdPer"><option value="">Pilih perwakilan…</option>${rows.map((r) => `<option${r.v[1] === T.per ? ' selected' : ''}>${esc(r.v[1])}</option>`).join('')}</select></label>
        <div class="kp-row"><span class="kp-lbl">Kelas tiket</span>${seg('kln', KLN, T.kln)}</div>
        <label class="kp-fld"><span>Kurs (Rp per US$) ${tip('Opsional. Tiket pindah luar negeri dalam dolar AS. Isi kurs yang dipakai satker untuk melihat perkiraan dalam Rupiah. Tersimpan di perangkat ini dan dipakai bersama Hitung Perjalanan.')}</span><span class="kp-kurs"><b>Rp</b><input id="pdKurs" type="text" inputmode="decimal" autocomplete="off" placeholder="Kosongkan bila cukup US$" value="${esc(kursTxt(kurs))}"></span></label>
      </div>
      <div class="kp-step"><h2 class="kp-h"><span class="step">2</span>Pegawai dan keluarga</h2>${tkSel}</div>
    </div>`;
  }
  return `<div class="card card-pad kp-form">
    <div class="kp-step"><h2 class="kp-h"><span class="step">1</span>Tujuan pindah<button type="button" class="btn sm danger kp-reset" id="pdReset">${ic('history')} Reset</button></h2>
      ${seg('lingkup', [['dn', 'Dalam negeri'], ['ln', 'Luar negeri']], T.lingkup)}
      <div class="route-form">${ui.placeField('pdAsal', 'Dari', placeLabel(T.asal), 'Kota/kabupaten asal')}${ui.placeField('pdKe', 'Ke', T.ke ? placeLabel(T.ke) : '', 'Kota/kabupaten tempat kerja baru')}</div>
      <div class="kp-row"><span class="kp-lbl">Tiket ${tip('Tabel tiket SBM memuat tarif pergi-pulang (PP), sedangkan pindah hanya sekali jalan. Bawaan dihitung setengah tarif PP sebagai pendekatan.')}</span>${seg('tiket', [['half', '½ tarif PP'], ['full', 'Tarif PP penuh']], T.tiket)}</div>
      <div class="kp-row"><span class="kp-lbl">Kelas tiket</span>${seg('kelas', [['eko', 'Ekonomi'], ['bis', 'Bisnis']], T.kelas)}</div>
      <div class="kp-row"><span class="kp-lbl">Uang harian (hari)</span>${stp('hari', T.hari, 0, 30, 'Hari uang harian')}</div>
    </div>
    <div class="kp-step"><h2 class="kp-h"><span class="step">2</span>Pegawai dan keluarga</h2>${tkSel}</div>
    <div class="kp-step"><h2 class="kp-h"><span class="step">3</span>Barang pindahan</h2>
      <div class="kp-row"><span class="kp-lbl">Moda</span></div>${seg('moda', MODA, T.moda)}
      <div class="pk-grid pd-grid"><label class="pk-f"><span>Volume barang (m³)</span><input class="iv-in" id="pdM3" inputmode="decimal" autocomplete="off" placeholder="0" value="${esc(T.m3)}"></label>
        ${T.moda !== 'kereta' ? `<label class="pk-f"><span>Jarak${T.moda === 'laut' ? ' darat' : ''} (km)</span><input class="iv-in" id="pdKm" inputmode="decimal" autocomplete="off" placeholder="0" value="${esc(T.km)}"></label>` : ''}</div>
      <div class="muted small kp-note">Volume dan jarak diisi sendiri; batas volume barang menurut ketentuan perjalanan dinas pindah tidak diterapkan di sini.${T.moda === 'kereta' ? ' Angkutan kereta api sesuai tarif yang berlaku (tidak tercantum angkanya).' : T.moda === 'laut' ? ' Angkutan laut/sungai sesuai tarif yang berlaku; yang dihitung pengepakan dan angkutan daratnya.' : ''}</div>
    </div>
  </div>`;
}

function resultHtml(T, res, effNotice) {
  if (!res.ready) return `<div class="empty small">${T.lingkup === 'ln' ? 'Pilih perwakilan tujuan.' : 'Pilih kota asal dan kota tujuan pindah.'}</div>`;
  const { table, per } = resTable(res);
  const notes = [...res.notes];
  if (res.alt.length) notes.push(`Rute tiket lain yang juga tercantum: ${res.alt.map(esc).join('; ')}. Perhitungan memakai rute pertama.`);
  if (res.missing.length) notes.push('Komponen yang tidak tercantum angkanya di tabel tidak ikut dijumlahkan.');
  const sum = T.lingkup === 'ln'
    ? `${res.dir} · ${res.total} orang`
    : `${plain(res.O.label)} → ${plain(res.D.label)} · ${res.total} orang${res.m3 ? ` · ${dec(res.m3)} m³ barang` : ''}`;
  const base = T.lingkup === 'ln'
    ? `Tiket pindah luar negeri sekali jalan dalam dolar AS sesuai SBM.${res.hasUsd && !res.kurs ? ' Isi kurs untuk melihat total dalam Rupiah.' : ''} Perjalanan dalam negeri ke/dari Jakarta bisa dihitung terpisah.`
    : `Transportasi dihitung sekali jalan: taksi di kota asal dan tujuan masing-masing 1 kali, transport darat 1 kali, tiket ${res.f === 1 ? 'tarif PP penuh' : 'setengah tarif PP'} karena tabel tiket SBM memuat tarif pergi-pulang. Uang harian mengikuti provinsi tujuan.`;
  return `${effNotice()}
  <div class="card kp-res">
    <div class="kp-res-h"><div><div class="kp-title">Perkiraan biaya perjalanan dinas pindah${T.lingkup === 'ln' ? ' luar negeri' : ''}</div><div class="muted small">${esc(sum)}</div></div>
      <div class="kp-actions"><button type="button" class="btn primary" id="pdPdf">${ic('download')} Unduh PDF</button></div></div>
    ${table}${per}
    <div class="kp-foot muted small">Satuan biaya mengikuti SBM TA ${Y.y} (${esc(Y.src)})${res.effOn ? ', dengan persentase dibayar yang sedang aktif' : ''}. ${base} ${notes.join(' ')}</div>
  </div>`;
}

export function viewPindah(ui) {
  const T = load();
  let kurs = Number(store.get('kurs', 0)) || 0;
  const save = () => store.set(KEY, T);
  const html = `<div class="page-head"><h1 class="title">Dinas Pindah</h1><p class="subtitle">Perkiraan biaya perjalanan dinas pindah. Dalam negeri: tiket atau transport sekali jalan untuk pegawai dan keluarga, taksi, uang harian, serta pengepakan dan angkutan barang (${S.butir['L1-24'].lamp === 1 ? 'Lamp. I' : 'Lamp. II'} angka ${S.butir['L1-24'].no}). Luar negeri: tiket pindah sekali jalan Jakarta–perwakilan (${S.butir['L1-28'].lamp === 1 ? 'Lamp. I' : 'Lamp. II'} angka ${S.butir['L1-28'].no}).</p></div>
  <div class="kp pd" id="pdRoot"></div>`;
  const after = () => {
    const { $, $$, toast, effNotice } = ui;
    const root = $('#pdRoot');
    const calc = () => (T.lingkup === 'ln' ? computeLN(T, kurs) : computeDN(T));
    const draw = () => {
      const res = calc();
      $('#pdHost').innerHTML = resultHtml(T, res, effNotice);
      const pdf = $('#pdPdf');
      if (pdf) pdf.onclick = async () => {
        pdf.disabled = true; const old = pdf.innerHTML; pdf.innerHTML = `${ic('clock')} Menyiapkan PDF…`;
        try {
          const ppl = ['Pegawai', `${TINGKAT.find((t) => t.k === T.tk).n}${T.kel ? `, ditambah ${T.kel} anggota keluarga` : ''}`];
          res.custom = T.lingkup === 'ln' ? {
            title: 'Perkiraan Biaya Perjalanan Dinas Pindah Luar Negeri',
            info: [['Arah', res.dir], ['Kelas', KLN.find((k) => k[0] === T.kln)[1]], ppl, ...(res.kurs ? [['Kurs', `Rp${kursTxt(res.kurs)} per US$`]] : [])],
            notes: ['Tiket pindah luar negeri sekali jalan dalam dolar AS sesuai SBM.', ...(res.kurs ? [`Total Rupiah memakai kurs Rp${kursTxt(res.kurs)} per US$ yang diisi pengguna.`] : [])],
            file: `Perkiraan-Dinas-Pindah-LN-${T.per.replace(/[^\w]+/g, '-')}-TA${Y.y}.pdf`,
          } : {
            title: 'Perkiraan Biaya Perjalanan Dinas Pindah',
            info: [['Asal', plain(res.O.label)], ['Tujuan', `${plain(res.D.label)} (${S.prov[res.D.prov].nama})`], ppl, ['Barang', res.m3 ? `${dec(res.m3)} m³, ${MODA.find((m) => m[0] === T.moda)[1]}${res.km ? `, ${dec(res.km)} km` : ''}` : '-']],
            notes: [
              `Transportasi sekali jalan: taksi di kota asal dan tujuan masing-masing 1 kali, transport darat 1 kali, tiket ${res.f === 1 ? 'tarif PP penuh' : 'setengah tarif PP'} (tabel tiket SBM memuat tarif pergi-pulang).`,
              'Volume barang dan jarak diisi pengguna; batas volume menurut ketentuan perjalanan dinas pindah tidak diterapkan.',
              ...res.notes,
            ],
            file: `Perkiraan-Dinas-Pindah-${plain(res.D.label).replace(/[^\w]+/g, '-')}-TA${Y.y}.pdf`.replace(/-+/g, '-'),
          };
          const out = await buildPdf(res);
          const a = document.createElement('a'); a.href = URL.createObjectURL(out.blob); a.download = out.name;
          document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
          toast('PDF diunduh');
        } catch (err) { console.error(err); toast('PDF gagal dibuat'); } finally { pdf.disabled = false; pdf.innerHTML = old; }
      };
    };
    const render = () => {
      root.innerHTML = formHtml(T, ui, kurs) + '<div id="pdHost"></div>';
      if ($('#pdAsal')) {
        ui.attachAC('pdAsal', (it) => { T.asal = it.id; save(); draw(); });
        ui.attachAC('pdKe', (it) => { T.ke = it.id; save(); draw(); });
      }
      $$('[data-clear]', root).forEach((b) => b.onclick = () => { const inp = $('#' + b.dataset.clear); inp.value = ''; inp.focus(); inp.dispatchEvent(new Event('input')); });
      draw();
    };
    const apply = (el, v, keepText = false) => {
      const min = Number(el.dataset.min), max = Number(el.dataset.max);
      v = Math.max(min, Math.min(max, Number.isFinite(v) ? v : min));
      if (!keepText) el.querySelector('input').value = v;
      el.querySelector('[data-d="-1"]').disabled = v <= min;
      el.querySelector('[data-d="1"]').disabled = v >= max;
      T[el.dataset.stp] = v; save(); draw();
    };
    root.addEventListener('click', (e) => {
      const b = e.target.closest('.stp button');
      if (b) { const el = b.closest('.stp'); apply(el, T[el.dataset.stp] + Number(b.dataset.d)); return; }
      if (e.target.closest('#pdReset')) { const l = T.lingkup; Object.assign(T, DEF(), { lingkup: l }); save(); render(); toast('Isian dikembalikan ke awal'); return; }
      const sg = e.target.closest('[data-lingkup],[data-tiket],[data-kelas],[data-moda],[data-arah],[data-kln]');
      if (!sg) return;
      const k = ['lingkup', 'tiket', 'kelas', 'moda', 'arah', 'kln'].find((x) => sg.dataset[x] != null);
      if (T[k] === sg.dataset[k]) return;
      T[k] = sg.dataset[k]; save();
      if (k === 'lingkup' || k === 'moda') render();
      else { $$(`[data-${k}]`, root).forEach((x) => { x.classList.toggle('on', x === sg); x.setAttribute('aria-checked', String(x === sg)); }); draw(); }
    });
    root.addEventListener('input', (e) => {
      const inp = e.target.closest('.stp-in');
      if (inp) { inp.value = inp.value.replace(/\D/g, ''); if (inp.value !== '') apply(inp.closest('.stp'), Number(inp.value), true); return; }
      if (e.target.id === 'pdM3' || e.target.id === 'pdKm') {
        const el = e.target; el.value = el.value.replace(/[^\d,.]/g, '').replace('.', ',').replace(/,(?=.*,)/g, '');
        T[el.id === 'pdM3' ? 'm3' : 'km'] = el.value; save(); draw(); return;
      }
      if (e.target.id === 'pdKurs') {
        const v = Number(e.target.value.replace(/[^\d,]/g, '').replace(',', '.'));
        kurs = v > 0 ? v : 0; store.set('kurs', kurs); draw();
      }
    });
    root.addEventListener('focusout', (e) => {
      const inp = e.target.closest('.stp-in'); if (inp) { const el = inp.closest('.stp'); apply(el, inp.value === '' ? T[el.dataset.stp] : Number(inp.value)); }
      if (e.target.id === 'pdKurs') e.target.value = kursTxt(kurs);
    });
    root.addEventListener('focusin', (e) => { const inp = e.target.closest('.stp-in, #pdM3, #pdKm'); if (inp) inp.select(); });
    root.addEventListener('keydown', (e) => { const inp = e.target.closest('.stp-in'); if (inp && e.key === 'Enter') inp.blur(); });
    root.addEventListener('change', (e) => {
      if (e.target.id === 'pdTk') { T.tk = e.target.value; save(); draw(); }
      if (e.target.id === 'pdPer') { T.per = e.target.value; save(); draw(); }
    });
    render();
  };
  return { html, after };
}
