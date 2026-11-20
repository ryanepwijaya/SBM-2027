"""Ikon aplikasi dan gambar pratinjau tautan (Open Graph). Jalankan: python3 scripts/build_icons.py"""
from PIL import Image, ImageDraw, ImageFont
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAVY, GOLD, WHITE, RED = (34, 45, 99), (244, 190, 22), (255, 255, 255), (218, 45, 29)
FB = '/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf'
FR = '/usr/share/fonts/opentype/inter/Inter-SemiBold.otf'

def icon(size, maskable=False, radius=0.22):
    S = size * 4
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if maskable:
        d.rectangle([0, 0, S, S], fill=NAVY)
        pad = int(S * 0.16)
    else:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * radius), fill=NAVY)
        pad = int(S * 0.08)
    inner = S - 2 * pad
    # garis emas di atas, seperti kop dokumen
    bw, bh = int(inner * 0.62), max(4, int(inner * 0.085))
    bx, by = (S - bw) // 2, pad + int(inner * 0.16)
    d.rounded_rectangle([bx, by, bx + bw, by + bh], radius=bh // 2, fill=GOLD)
    f = ImageFont.truetype(FB, int(inner * 0.40))
    t = 'SBM'
    tb = d.textbbox((0, 0), t, font=f)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    ty = by + bh + int(inner * 0.13)
    d.text(((S - tw) // 2 - tb[0], ty - tb[1]), t, font=f, fill=WHITE)
    # garis tipis emas di bawah teks
    uy = ty + th + int(inner * 0.11)
    uw = int(inner * 0.22)
    d.rounded_rectangle([(S - uw) // 2, uy, (S + uw) // 2, uy + max(3, bh // 2)], radius=bh // 4, fill=GOLD)
    return im.resize((size, size), Image.LANCZOS)

icons = os.path.join(ROOT, 'icons')
icon(512).save(os.path.join(icons, 'icon-512.png'), optimize=True)
icon(192).save(os.path.join(icons, 'icon-192.png'), optimize=True)
icon(64, radius=0.24).save(os.path.join(icons, 'favicon-64.png'), optimize=True)
icon(512, maskable=True).save(os.path.join(icons, 'maskable-512.png'), optimize=True)
a = icon(180, maskable=True)
a.save(os.path.join(icons, 'apple-touch-icon.png'), optimize=True)

# Gambar pratinjau tautan 1200x630
W, H = 1200, 630
og = Image.new('RGB', (W, H), NAVY)
d = ImageDraw.Draw(og)
d.rectangle([0, 0, W, 14], fill=GOLD)
d.rectangle([0, 14, W, 18], fill=RED)
d.rounded_rectangle([80, 140, 320, 380], radius=56, fill=(48, 61, 128))
ic = icon(220)
og.paste(ic, (90, 150), ic)
ft = ImageFont.truetype(FB, 64)
fs = ImageFont.truetype(FR, 30)
fu = ImageFont.truetype(FR, 28)
d.text((350, 170), 'Standar Biaya', font=ft, fill=WHITE)
d.text((350, 245), 'Masukan', font=ft, fill=WHITE)
d.text((352, 340), 'Satuan biaya, rute perjalanan dinas, dan alat hitung', font=fs, fill=(214, 220, 240))
d.text((352, 382), 'dalam satu aplikasi. TA 2026 dan TA 2027.', font=fs, fill=(214, 220, 240))
d.rounded_rectangle([90, 500, 400, 556], radius=28, fill=GOLD)
d.text((118, 511), 'cek-sbm.vercel.app', font=fu, fill=NAVY)
og.save(os.path.join(icons, 'og-image.png'), optimize=True)
print('ok')
