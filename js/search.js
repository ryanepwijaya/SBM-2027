// Mesin pencarian dalam aplikasi
import { ENTRIES, SOON_SYN, CITY_ALIAS, GROUPS } from './catalog.js';
import { S, norm, esc, fmt, valueCols, shortCol, entriesOf, rapatTiers } from './store.js';
import { matchPlace, suggest } from './rute.js';

const STOP = new Set(['di', 'ke', 'dari', 'untuk', 'yang', 'dan', 'atau', 'berapa', 'sbm', 'biaya', 'satuan', 'besaran',
  'kmk', 'pmk', 'tahun', '2027', '2026', 'standar', 'masukan', 'nya', 'apa', 'cara', 'aturan', 'ketentuan', 'tarif', 'harga',
  'maksimal', 'max', 'batas', 'per', 'orang', 'the', 'kalau', 'jika', 'saja', 'aja', 'gimana', 'bagaimana']);

let IDX = null;

function wordRe(phrase) {
  return new RegExp('(^| )' + phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '( |$)');
}

function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[m][n];
}

export function buildIndex() {
  const vocab = new Set();
  const addVocab = (s) => norm(s).split(' ').forEach((w) => w.length > 2 && vocab.add(w));

  // Provinsi & alias
  const provPhrases = [];
  for (const p of S.provList) {
    const names = [p.nama, ...p.alias];
    if (p.nama.startsWith('Sumatra')) names.push(p.nama.replace('Sumatra', 'Sumatera'));
    for (const n of names) { provPhrases.push([norm(n), p.id]); addVocab(n); }
  }
  provPhrases.sort((a, b) => b[0].length - a[0].length);

  // Kota tiket DN
  const tiket = S.butir['L2-6'].tables[0].rows.filter((r) => r.v);
  const cities = new Map();
  for (const r of tiket) { cities.set(norm(r.v[1]), r.v[1]); cities.set(norm(r.v[2]), r.v[2]); }
  for (const [a, c] of Object.entries(CITY_ALIAS)) if (cities.has(norm(c))) cities.set(norm(a), cities.get(norm(c)));
  for (const k of cities.keys()) addVocab(k);
  const cityPhrases = [...cities.keys()].sort((a, b) => b.length - a.length);

  // Entri menu
  const entryPhrases = [];
  for (const e of ENTRIES) {
    for (const s of [e.name, ...e.syn]) { entryPhrases.push([norm(s), e.key]); addVocab(s); }
  }
  entryPhrases.sort((a, b) => b[0].length - a[0].length);

  // Baris data pada butir aktif (label = sel teks selain nomor/satuan)
  const rows = [];
  for (const b of S.data.butir) {
    if (!b.active) continue;
    b.tables.forEach((t, ti) => {
      const vc = new Set(valueCols(t));
      let grp = '';
      for (const r of t.rows) {
        if (r.g) { grp = r.g; continue; }
        const labels = r.v.filter((x, i) => i > 0 && !vc.has(i) && !/^(O[A-Z]{1,2}|Orang\/Kali|Setel|m3|km\/m3)$/i.test(x) && !/^Sesuai tarif/.test(x));
        const text = norm(labels.join(' ') + ' ' + grp);
        labels.forEach(addVocab);
        rows.push({ b, ti, r, labels, grp, text });
      }
    });
  }

  // Penjelasan (aktif)
  const pens = [];
  for (const b of S.data.butir) {
    if (!b.active) continue;
    b.pen.forEach((bl, i) => pens.push({ b, i, x: bl.x, n: norm(bl.x) }));
    pens.push({ b, i: -1, x: b.def, n: norm(b.def) });
  }

  // Butir non-aktif
  const soon = S.data.butir.filter((b) => !b.active).map((b) => ({ b, n: norm(b.title) }));
  for (const list of Object.values(SOON_SYN)) list.forEach(addVocab);
  soon.forEach((s) => addVocab(s.b.title));

  IDX = { vocab: [...vocab], provPhrases, cityPhrases, cities, entryPhrases, rows, pens, soon };
}

function correct(tokens) {
  let changed = false;
  const vocabSet = new Set(IDX.vocab);
  const out = tokens.map((t) => {
    if (t.length < 4 || vocabSet.has(t) || /^\d/.test(t)) return t;
    if (IDX.vocab.some((v) => v.startsWith(t))) return t;
    const max = t.length >= 7 ? 2 : 1;
    let best = null, bd = 9;
    for (const v of IDX.vocab) {
      if (Math.abs(v.length - t.length) > max) continue;
      const d = lev(t, v);
      if (d < bd) { bd = d; best = v; }
      if (d === 0) break;
    }
    if (best && bd <= max) { changed = true; return best; }
    return t;
  });
  return { tokens: out, changed };
}

function takePhrases(q, phrases) {
  const found = [];
  let rest = ' ' + q + ' ';
  for (const [ph, id] of phrases) {
    const re = wordRe(ph);
    if (re.test(rest.trim()) || rest.includes(' ' + ph + ' ')) {
      if (rest.includes(' ' + ph + ' ')) {
        found.push(id);
        rest = rest.replace(' ' + ph + ' ', '  ');
      }
    }
  }
  return { found: [...new Set(found)], rest: rest.replace(/\s+/g, ' ').trim() };
}

function summarize(t, r, max = 4) {
  const vc = valueCols(t);
  return vc.slice(0, max).map((i) => `${shortCol(t.cols[i])} ${r.n[i] != null ? fmt(r.n[i], t.cur) : esc(r.v[i])}`).join(' · ');
}

function hrefRow(b, ti, code, extra = '') {
  return `#/b/${b.id}?t=${ti}&r=${encodeURIComponent(code)}${extra}`;
}

function mark(text, tokens) {
  let h = esc(text);
  for (const t of tokens) {
    if (t.length < 3) continue;
    h = h.replace(new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>');
  }
  return h;
}

function snippet(text, tokens, len = 170) {
  const n = text.toLowerCase();
  let pos = -1;
  for (const t of tokens) { const p = n.indexOf(t); if (p >= 0 && (pos < 0 || p < pos)) pos = p; }
  let s = pos > 60 ? '…' + text.slice(pos - 50) : text;
  if (s.length > len) s = s.slice(0, len) + '…';
  return mark(s, tokens);
}

const PROV_ENTRIES = ['uh-dn', 'penginapan', 'taksi', 'rapat'];

export function search(qRaw) {
  if (!IDX) buildIndex();
  const out = { best: [], menus: [], rows: [], pens: [], soon: [], corrected: null, prov: [], query: qRaw };
  let q = norm(qRaw);
  if (!q) return out;

  // koreksi salah ketik
  const cr = correct(q.split(' '));
  if (cr.changed) { out.corrected = cr.tokens.join(' '); q = out.corrected; }

  // Rute: "dari X ke Y" / "X ke Y"
  const m = q.match(/^(?:dari\s+)?(.*?)\s*\bke\s+(.+)$/);
  if (m && m[2]) {
    const to = matchPlace(m[2]);
    const from = m[1] ? matchPlace(m[1]) : null;
    if (to) {
      const fromId = from ? from.id : 'jakarta';
      out.best.push({ t: `Rute perjadin ${from ? from.n : 'Jakarta'} → ${to.n}`, d: 'Taksi, tiket, transport darat, uang harian, penginapan, dan paket rapat untuk rute ini.', href: `#/rute?dari=${encodeURIComponent(fromId)}&ke=${encodeURIComponent(to.id)}`, kind: 'Rute' });
      return { ...out, tokens: [] };
    }
  }

  const pr = takePhrases(q, IDX.provPhrases);
  const er = takePhrases(pr.rest, IDX.entryPhrases);
  const cityR = takePhrases(q, IDX.cityPhrases.map((c) => [c, c]));
  const provs = pr.found;
  let ents = er.found;
  const cityNames = cityR.found.map((c) => IDX.cities.get(c));
  const restTokens = er.rest.split(' ').filter((t) => t && !STOP.has(t));
  const allTokens = q.split(' ').filter((t) => t && !STOP.has(t));
  const isLN = /(^| )(ln|luar negeri)( |$)/.test(q);

  // Konteks LN: geser ke entri LN
  if (isLN) {
    ents = ents.map((k) => (k === 'uh-dn' ? 'uh-ln' : k === 'tiket-dn' ? 'tiket-ln' : k));
    if (!ents.some((k) => ['uh-ln', 'tiket-ln', 'tiket-pindah-ln'].includes(k))) ents.unshift('uh-ln', 'tiket-ln');
  }
  ents = [...new Set(ents)];
  if (/(^| )perjadin|perjalanan dinas( |$)/.test(q) && !ents.length && !provs.length) {
    out.best.push({ t: 'Perjalanan Dinas', d: 'Semua jenis satuan biaya perjalanan dinas: dalam negeri, luar negeri, dan pindah.', href: '#/jelajah', kind: 'Jelajah' });
    ents = ENTRIES.map((e) => e.key);
  }

  // 1) Provinsi + jenis biaya
  const routeMode = cityNames.length >= 2;
  for (const pid of (routeMode ? [] : provs)) {
    const p = S.prov[pid];
    const targets = ents.length ? ents.filter((k) => PROV_ENTRIES.includes(k) || k === 'darat') : [];
    if (!targets.length) {
      out.best.push({ t: p.nama, d: 'Semua satuan biaya perjalanan dinas untuk provinsi ini dalam satu halaman', href: `#/daerah/p/${pid}`, kind: 'Daerah' });
    }
    for (const k of targets) {
      const e = ENTRIES.find((x) => x.key === k);
      const b = S.butir[e.butir];
      const t = b.tables[e.table];
      if (k === 'rapat') {
        for (const tier of rapatTiers()) {
          const r = tier.rows.find((x) => x.p === pid);
          if (r) out.best.push({ t: `${e.name} · ${p.nama}`, d: `${tier.name}: ${summarize(t, r)}`, href: hrefRow(b, 0, r.c), kind: 'Baris tabel' });
        }
        continue;
      }
      if (k === 'darat') {
        out.best.push({ t: `${e.name} · ${p.nama}`, d: 'Daftar rute dari ibu kota provinsi', href: `#/b/${b.id}?t=0&p=${pid}`, kind: 'Tabel' });
        continue;
      }
      const r = t.rows.find((x) => x.v && x.p === pid);
      if (r) out.best.push({ t: `${e.name} · ${p.nama}`, d: summarize(t, r), href: hrefRow(b, e.table, r.c), kind: 'Baris tabel' });
      else out.best.push({ t: `${e.name} · ${p.nama}`, d: 'Tidak tercantum dalam tabel KMK untuk provinsi ini.', href: `#/b/${b.id}`, kind: 'Catatan' });
    }
  }

  // 2) Rute tiket (dua kota)
  const tiketB = S.butir['L2-6'];
  if (cityNames.length >= 2 || (cityNames.length === 1 && ents.includes('tiket-dn'))) {
    const set = cityNames.map((c) => c.toUpperCase());
    const rows = tiketB.tables[0].rows.filter((r) => r.v && (cityNames.length >= 2
      ? set.includes(r.v[1].toUpperCase()) && set.includes(r.v[2].toUpperCase())
      : set.includes(r.v[1].toUpperCase()) || set.includes(r.v[2].toUpperCase())));
    if (cityNames.length >= 2) {
      for (const r of rows) out.best.push({ t: `Tiket ${r.v[1]} ⇄ ${r.v[2]}`, d: `Bisnis ${fmt(r.n[3])} · Ekonomi ${fmt(r.n[4])} (PP)`, href: hrefRow(tiketB, 0, r.c), kind: 'Tiket DN' });
      if (!rows.length) out.best.push({ t: `Rute ${cityNames.join(' ⇄ ')}`, d: 'Rute ini tidak tercantum dalam tabel tiket KMK 296/2026.', href: `#/b/L2-6?q=${encodeURIComponent(cityNames[0])}`, kind: 'Tiket DN' });
    } else {
      out.best.push({ t: `Tiket pesawat dari/ke ${cityNames[0]}`, d: `${rows.length} rute tercantum`, href: `#/b/L2-6?q=${encodeURIComponent(cityNames[0])}`, kind: 'Tiket DN' });
    }
  }

  // 3) Menu (jenis biaya)
  for (const k of ents) {
    const e = ENTRIES.find((x) => x.key === k);
    out.menus.push({ t: e.name, d: e.desc, href: `#/b/${e.butir}?t=${e.table}`, sifat: S.butir[e.butir].sifat, ref: S.butir[e.butir] });
  }
  if (!ents.length && allTokens.length) {
    // pencocokan awalan pada nama/sinonim
    for (const e of ENTRIES) {
      const hay = norm([e.name, e.desc, ...e.syn].join(' '));
      if (allTokens.every((t) => hay.split(' ').some((w) => w.startsWith(t)))) {
        out.menus.push({ t: e.name, d: e.desc, href: `#/b/${e.butir}?t=${e.table}`, sifat: S.butir[e.butir].sifat, ref: S.butir[e.butir] });
      }
    }
  }

  // 4) Baris data (kab/kota, negara, kota LN, perwakilan, dll.)
  const fallbackTokens = pr.rest.split(' ').filter((t) => t && !STOP.has(t) && t.length >= 3);
  const rowTokens = routeMode ? [] : (restTokens.length ? restTokens : fallbackTokens);
  if (rowTokens.length) {
    let hits = [];
    for (const it of IDX.rows) {
      const words = it.text.split(' ');
      if (rowTokens.every((t) => words.some((w) => w.startsWith(t)))) hits.push(it);
    }
    if (!restTokens.length && hits.length > 10) hits = [];
    const seen = new Set(out.best.map((x) => x.href));
    for (const it of hits.slice(0, 40)) {
      const t = it.b.tables[it.ti];
      const href = hrefRow(it.b, it.ti, it.r.c);
      if (seen.has(href)) continue;
      const e = entriesOf(it.b.id).find((x) => x.table === it.ti) || entriesOf(it.b.id)[0];
      out.rows.push({ t: mark(it.labels.join(' – '), rowTokens), d: `${e ? e.name : it.b.title}${it.grp && !it.labels.includes(it.grp) ? ' · ' + esc(it.grp) : ''}`, v: summarize(t, it.r, 4), href, html: true, bid: it.b.id });
    }
    // tingkatkan ke "best" bila tepat satu-dua hasil kuat
    if (!out.best.length && out.rows.length && out.rows.length <= 3) {
      out.best.push(...out.rows.splice(0, out.rows.length).map((r) => ({ t: r.t, d: r.v, href: r.href, kind: r.d, html: true })));
    }
  }

  // Konteks LN dari hasil baris (mis. nama negara)
  const lnHit = [...out.best, ...out.rows].some((x) => /L1-26|L2-7|L1-28/.test(x.href));
  if (lnHit) out.menus = out.menus.map((m) => {
    const swap = { 'L1-25': 'uh-ln', 'L2-6': 'tiket-ln' }[(m.href.match(/#\/b\/([^?]+)/) || [])[1]];
    if (!swap) return m;
    const e = ENTRIES.find((x) => x.key === swap);
    return { t: e.name, d: e.desc, href: `#/b/${e.butir}?t=${e.table}`, sifat: S.butir[e.butir].sifat, ref: S.butir[e.butir] };
  });

  // 5) Penjelasan
  if (allTokens.length) {
    const pt = allTokens.filter((t) => t.length >= 3 || /^\d{2,}$/.test(t));
    if (pt.length) {
      for (const p of IDX.pens) {
        const words = p.n.split(' ');
        if (pt.every((t) => words.some((w) => w.startsWith(t)))) {
          const e = entriesOf(p.b.id)[0];
          out.pens.push({ t: e ? e.name : p.b.title, d: snippet(p.x, pt), href: `#/b/${p.b.id}?hl=${encodeURIComponent(pt.join(' '))}#${p.i < 0 ? 'def' : 'pen'}`, src: p.i < 0 ? 'Definisi PMK 54/2026' : 'Penjelasan KMK 296/2026' });
          if (out.pens.length >= 12) break;
        }
      }
    }
  }

  if (ents.length && out.pens.length) {
    const own = new Set(ents.map((k) => ENTRIES.find((e) => e.key === k)?.butir));
    out.pens.sort((a, b) => (own.has(b.href.split('/')[2].split('?')[0]) ? 1 : 0) - (own.has(a.href.split('/')[2].split('?')[0]) ? 1 : 0));
  }

  // 6) Belum tersedia
  const soonKel = new Set();
  for (const [kel, list] of Object.entries(SOON_SYN)) {
    for (const s of list) if (wordRe(norm(s)).test(q)) soonKel.add(kel);
  }
  const soonHits = [];
  if (allTokens.length) {
    for (const s of IDX.soon) {
      const words = s.n.split(' ');
      if (allTokens.filter((t) => t.length >= 3).length && allTokens.filter((t) => t.length >= 3).every((t) => words.some((w) => w.startsWith(t)))) soonHits.push(s.b);
    }
  }
  if (!soonHits.length) {
    for (const kel of soonKel) {
      const kws = SOON_SYN[kel].filter((k) => wordRe(norm(k)).test(q)).map((k) => norm(k));
      const byTitle = S.data.butir.filter((b) => !b.active && b.kel === kel && kws.some((k) => k.split(' ').every((w) => norm(b.title).split(' ').some((x) => x.startsWith(w)))));
      soonHits.push(...(byTitle.length ? byTitle : S.data.butir.filter((b) => !b.active && b.kel === kel).slice(0, 4)));
    }
  }
  out.soon = [...new Set(soonHits)].slice(0, 8);

  // Saran rute untuk nama kabupaten/kota (bila bukan pencarian jenis biaya)
  if (!ents.length && !soonKel.size && !out.soon.length) {
    const pl = suggest(qRaw, 2).filter((x) => x.id !== 'jakarta');
    for (const x of pl.slice(0, provs.length ? 1 : 2)) {
      out.best.push({ t: `Rute perjadin Jakarta → ${x.n}`, d: `${x.sub}. Semua satuan biaya perjalanan dinas untuk rute ini.`, href: `#/rute?dari=jakarta&ke=${encodeURIComponent(x.id)}`, kind: 'Rute' });
    }
  }
  out.prov = provs;
  out.tokens = allTokens;
  return out;
}

export const SEARCH_HINTS = ['uang harian jatim', 'penginapan dki', 'jakarta surabaya', 'taksi bali', 'fullboard sulsel', 'bekasi', 'kab sleman', 'jepang', '60%', 'diklat'];
export { GROUPS };
