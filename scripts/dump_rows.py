import sys, json, re, pdfplumber
pdf = pdfplumber.open(sys.argv[1])
pages = list(range(3,51)) + list(range(69,119))
out=[]
CODE = re.compile(r'^\d{1,2}(\.\d{1,3})*\.?$')
for pn in pages:
    p = pdf.pages[pn-1]
    for ti,t in enumerate(p.extract_tables()):
        for r in t:
            cells=[(c or '').replace('\n',' ').strip() if c is not None else None for c in r]
            out.append({'page':pn,'t':ti,'cells':cells})
json.dump(out, open(sys.argv[2],'w'), ensure_ascii=False)
print(len(out))
