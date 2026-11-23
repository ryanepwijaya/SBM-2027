// Pembuat file Word (.docx) kecil tanpa pustaka luar: paragraf, teks tebal/miring, tabel, dan arsip ZIP (tanpa kompresi).
const X = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// runs: string atau [{ t, b, i, u }]
const runsXml = (runs, base = {}) => (typeof runs === 'string' || typeof runs === 'number' ? [{ t: String(runs) }] : runs).map((r) => {
  const o = { ...base, ...r };
  const pr = `${o.b ? '<w:b/>' : ''}${o.i ? '<w:i/>' : ''}${o.u ? '<w:u w:val="single"/>' : ''}${o.size ? `<w:sz w:val="${o.size * 2}"/><w:szCs w:val="${o.size * 2}"/>` : ''}`;
  return String(o.t).split('\n').map((line, k) => `${k ? '<w:r><w:br/></w:r>' : ''}<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ''}<w:t xml:space="preserve">${X(line)}</w:t></w:r>`).join('');
}).join('');

// Paragraf. opts: align (left|center|right|both), b, i, size (pt), after/before (pt), indent (cm), hanging (cm), keep
export function P(runs = '', o = {}) {
  const pPr = `${o.keep ? '<w:keepNext/>' : ''}<w:spacing w:before="${Math.round((o.before ?? 0) * 20)}" w:after="${Math.round((o.after ?? 4) * 20)}" w:line="${o.line ?? 264}" w:lineRule="auto"/>${o.indent || o.hanging ? `<w:ind w:left="${Math.round((o.indent || 0) * 567)}"${o.hanging ? ` w:hanging="${Math.round(o.hanging * 567)}"` : ''}/>` : ''}${o.align ? `<w:jc w:val="${o.align}"/>` : ''}`;
  return `<w:p><w:pPr>${pPr}</w:pPr>${runsXml(runs, { b: o.b, i: o.i, size: o.size })}</w:p>`;
}

// Tabel. rows: [[cell, ...]]; cell: string | { c: runs | [P(...)], b, align, span, shade, valign }
// o: widths (cm, jumlahnya = lebar teks), border (true|false|'outer'), size (pt), pad (cm)
export function T(rows, o = {}) {
  const tw = (o.widths || []).map((w) => Math.round(w * 567));
  const line = '<w:{s} w:val="single" w:sz="4" w:space="0" w:color="808080"/>';
  const none = '<w:{s} w:val="nil"/>';
  const b = o.border === false ? none : line;
  const inner = o.border === 'outer' || o.border === false ? none : line;
  const borders = `<w:tblBorders>${['top', 'left', 'bottom', 'right'].map((s) => b.replace('{s}', s)).join('')}${['insideH', 'insideV'].map((s) => inner.replace('{s}', s)).join('')}</w:tblBorders>`;
  const pad = Math.round((o.pad ?? 0.12) * 567);
  const tblPr = `<w:tblPr><w:tblW w:w="${tw.reduce((a, x) => a + x, 0)}" w:type="dxa"/>${borders}<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="${pad}" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="${pad}" w:type="dxa"/></w:tblCellMar></w:tblPr>`;
  const grid = `<w:tblGrid>${tw.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`;
  const body = rows.map((r) => {
    let col = 0;
    return `<w:tr><w:trPr><w:cantSplit/></w:trPr>${r.map((cell) => {
      const c = cell && typeof cell === 'object' && !Array.isArray(cell) ? cell : { c: cell };
      const span = c.span || 1;
      const w = tw.slice(col, col + span).reduce((a, x) => a + x, 0); col += span;
      const isXml = (v) => typeof v === 'string' && v.startsWith('<w:');
      const content = isXml(c.c) ? c.c : Array.isArray(c.c) && c.c.length && isXml(c.c[0]) ? c.c.join('') : P(c.c ?? '', { align: c.align, b: c.b, size: c.size ?? o.size, after: 0 });
      return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ''}${c.shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${c.shade}"/>` : ''}<w:vAlign w:val="${c.valign || 'top'}"/></w:tcPr>${content}</w:tc>`;
    }).join('')}</w:tr>`;
  }).join('');
  return `<w:tbl>${tblPr}${grid}${body}</w:tbl>`;
}

// ---------- ZIP (STORE) ----------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (u8) => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function zip(files) {
  const enc = new TextEncoder();
  const parts = [], central = [];
  let off = 0;
  for (const [name, text] of files) {
    const nm = enc.encode(name), data = enc.encode(text), crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true); lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
    lh.setUint16(26, nm.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), nm, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, 0, true); ch.setUint16(14, 0x21, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
    ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
    central.push(new Uint8Array(ch.buffer), nm);
    off += 30 + nm.length + data.length;
  }
  const csize = central.reduce((a, x) => a + x.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csize, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

// Susun dokumen A4. body: string XML gabungan P()/T(). margin (cm)
export function docx(body, { title = 'Dokumen', margin = 2, font = 'Arial', size = 11 } = {}) {
  const m = Math.round(margin * 567);
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const files = [
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>'],
    ['docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${X(title)}</dc:title><dc:creator>cek-sbm.vercel.app</dc:creator></cp:coreProperties>`],
    ['word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
    ['word/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}" w:eastAsia="${font}"/><w:sz w:val="${size * 2}"/><w:szCs w:val="${size * 2}"/><w:lang w:val="id-ID"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblCellMar><w:left w:w="108" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>`],
    ['word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="${m}" w:right="${m}" w:bottom="${m}" w:left="${m}" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`],
  ];
  return zip(files);
}

// Terbilang bahasa Indonesia, mis. 3602000 → "Tiga Juta Enam Ratus Dua Ribu Rupiah"
export function terbilang(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  const s = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
  const f = (x) => {
    if (x < 12) return s[x];
    if (x < 20) return `${f(x - 10)} belas`;
    if (x < 100) return `${f(Math.floor(x / 10))} puluh ${f(x % 10)}`;
    if (x < 200) return `seratus ${f(x - 100)}`;
    if (x < 1000) return `${f(Math.floor(x / 100))} ratus ${f(x % 100)}`;
    if (x < 2000) return `seribu ${f(x - 1000)}`;
    if (x < 1e6) return `${f(Math.floor(x / 1000))} ribu ${f(x % 1000)}`;
    if (x < 1e9) return `${f(Math.floor(x / 1e6))} juta ${f(x % 1e6)}`;
    if (x < 1e12) return `${f(Math.floor(x / 1e9))} miliar ${f(x % 1e9)}`;
    return `${f(Math.floor(x / 1e12))} triliun ${f(x % 1e12)}`;
  };
  const t = n === 0 ? 'nol' : f(n);
  return `${t.replace(/\s+/g, ' ').trim()} rupiah`.replace(/\b\w/g, (c) => c.toUpperCase());
}
