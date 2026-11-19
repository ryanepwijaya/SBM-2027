"""SBM TA 2026: Penjelasan per butir + Catatan Umum dari PMK 32/2025 (pdftotext -layout).
Output: text.json {"L1-1": {"title": ..., "pen": [blocks]}, "_catatan_umum": {...}}
"""
import json, re, sys, difflib

pmk = open(sys.argv[1]).read().split('\n')
tables = json.load(open(sys.argv[2]))

PAGE = re.compile(r'^\s*-\s?\d+\s?-\s*$')
HEAD = re.compile(r'^(\s{0,12})(\d{1,2})\.?\s+(\S.*)$')
KEL = re.compile(r'^\s{0,6}([A-E])\.\s+SATUAN BIAYA')

def nrm(s):
    return re.sub(r'[^a-z0-9]', '', s.lower())

def clean(lines):
    return [l.rstrip() for l in lines if not PAGE.match(l)]

def split_items(lines, count, lamp):
    """Pecah baris menjadi item bernomor 1..count berdasarkan urutan."""
    items = {}
    expect = 1
    cur = None
    for l in lines:
        m = HEAD.match(l)
        if m and int(m.group(2)) == expect and len(m.group(1)) <= 12:
            title_ref = tables[f'L{lamp}-{expect}']['title_kmk'] or ''
            # verifikasi: teks setelah nomor mirip judul
            r = difflib.SequenceMatcher(None, nrm(m.group(3))[:40], nrm(title_ref)[:40]).ratio()
            if r > 0.45 or expect == 1:
                cur = expect
                items[cur] = [m.group(3)]
                expect += 1
                continue
        if KEL.match(l):
            continue
        if cur is not None:
            items[cur].append(l)
    assert len(items) == count, (lamp, len(items), sorted(items))
    return items

def take_title(item_lines, ref):
    """Gabungkan baris judul selama kemiripan dengan judul acuan naik."""
    ref_n = nrm(ref)
    acc = item_lines[0].strip()
    i = 1
    while i < len(item_lines):
        nxt = item_lines[i].strip()
        if not nxt:
            i += 1
            continue
        a = difflib.SequenceMatcher(None, nrm(acc), ref_n).ratio()
        b = difflib.SequenceMatcher(None, nrm(acc + ' ' + nxt), ref_n).ratio()
        if b > a + 0.02:
            acc = acc + ' ' + nxt
            i += 1
        else:
            break
    return re.sub(r'\s+', ' ', acc), item_lines[i:]

MARK = re.compile(r'^(\d+\.\d+\.?|\d+\)|[a-z]\)|[a-z]\.|\d+\.)\s+(.*)$')

def mtype(mk):
    if re.match(r'^\d+\.\d+\.?$', mk): return 'H'
    if re.match(r'^\d+\.$', mk): return 'N'
    if re.match(r'^[a-z]\.$', mk): return 'A'
    if re.match(r'^\d+\)$', mk): return 'NP'
    return 'AP'

def blocks(body):
    body = [l for l in body if l.strip() and not re.fullmatch(r'\s*\d{1,3}\s*', l)]
    if not body:
        return []
    base = min(len(l) - len(l.lstrip()) for l in body)
    out, stack = [], []
    prev_len = 0
    for raw in body:
        ind = len(raw) - len(raw.lstrip())
        s = re.sub(r'\s{2,}', ' ', raw.strip())
        m = MARK.match(s)
        if m:
            mk, txt = m.group(1), m.group(2)
            ty = mtype(mk)
            if ty == 'H':
                stack = []
                out.append({'t': 'h', 'm': mk.rstrip('.'), 'lvl': 0, 'x': txt})
            else:
                if ty in stack:
                    while stack[-1] != ty:
                        stack.pop()
                else:
                    stack.append(ty)
                out.append({'t': 'li', 'm': mk, 'lvl': len(stack) - 1, 'x': txt})
        elif out and (s[0].islower() or s[0] in '(/,;' or (out[-1]['t'] != 'h' and not out[-1]['x'].rstrip().endswith(('.', ':', ';'))) or (out[-1]['t'] == 'h' and out[-1]['x'].rstrip().endswith(('/', ',')))):
            out[-1]['x'] += ' ' + s
        else:
            if ind > base + 1 and stack:
                lvl = len(stack)
            else:
                stack = []
                lvl = 0
            out.append({'t': 'p', 'lvl': lvl, 'x': s})
        prev_len = len(raw.rstrip())
    for b in out:
        b['x'] = re.sub(r'\s+', ' ', b['x']).replace(' .', '.').strip()
    return out


pen = [i for i, l in enumerate(pmk) if l.strip() == 'PENJELASAN']
cu1 = next(i for i, l in enumerate(pmk) if l.strip().startswith('Catatan Umum Lampiran I:'))
cu2 = next(i for i, l in enumerate(pmk) if l.strip().startswith('Catatan Umum Lampiran II:'))
out = {}
for lamp, s, e, cnt in ((1, pen[0], cu1, 39), (2, pen[1], cu2, 19)):
    lines = clean(pmk[s + 3:e])
    items = split_items(lines, cnt, lamp)
    for k, ls in items.items():
        key = f'L{lamp}-{k}'
        title, body = take_title(ls, tables[key]['title_kmk'])
        out[key] = {'title': title, 'pen': blocks(body)}

def cu_blocks(s, end_pat):
    e = next(i for i, l in enumerate(pmk) if i > s and re.search(end_pat, l))
    return blocks(clean(pmk[s + 1:e]))

def cu_tail(s, start_pat, end_pat):
    a = next(i for i, l in enumerate(pmk) if i > s and re.search(start_pat, l))
    e = next(i for i, l in enumerate(pmk) if i > a and re.search(end_pat, l))
    txt = ' '.join(l.strip() for l in clean(pmk[a:e]))
    return re.sub(r'\s+', ' ', txt).strip()

out['_catatan_umum'] = {
    'L1': cu_blocks(cu1, r'^\s*6\.\s+untuk satuan biaya'),
    'L2': cu_blocks(cu2, r'^\s*3\.\s+Untuk satuan biaya'),
    'tol_L1': cu_tail(cu1, r'^\s*6\.\s+untuk satuan biaya', r'No\.\s+Provinsi'),
    'tol_L2': cu_tail(cu2, r'^\s*3\.\s+Untuk satuan biaya', r'No\.\s+Provinsi'),
}
json.dump(out, open(sys.argv[3], 'w'), ensure_ascii=False, indent=1)
for k in ['L1-1', 'L1-28', 'L1-30', 'L2-1', 'L2-17']:
    print(k, '|', out[k]['title'])
    for b in out[k]['pen'][:6]:
        print('   ', b['t'], b['lvl'], b.get('m', ''), b['x'][:110])
print(out['_catatan_umum']['tol_L1'][:200])
