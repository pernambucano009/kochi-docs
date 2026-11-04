"""قالب «بطاقة القياس باسم العيادة» (مرجع 40): بطاقة سودا باسم العيادة تدخل قدام الابتسامة وتتقلب فيظهر جدول نسب السنان الحقيقية،
ثم ماكرو البعد معزول بخطوط لثة ملونة لكل سنة، ثم أسماء المناطق التشريحية، ثم الشعار."""
import sys, subprocess, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
import anim
from anim import Shot, ease, FW, FH, FPS, FD
OUT, MUSIC, MOFF = (ARGS + ["x", "x", "0"])[0], (ARGS + ["x", "x", "0"])[1], float((ARGS + ["x", "x", "0"])[2]); CLINIC = ARGS[3] if len(ARGS) > 3 else "عيادة د. إسلام جمعة"; DOC = ARGS[4] if len(ARGS) > 4 else "د. إسلام جمعة"
C = ((__import__("os").environ.get("DENTAL_ROOT") or __import__("os").path.dirname(__import__("os").path.dirname(__import__("os").path.abspath(__file__)))) + "/case1/")
S1 = Shot(C + "ret/smile_front_ret4.jpg", "ai_smile.png", "lab_smile.json"); S1.cw *= 1.25; S1.ch *= 1.25
_xi = incisal_x(S1, 1.0) if False else None
S2 = Shot(C + "after/front.jpg", "ai_after.png", "lab_after.json")
F = lambda n, s: ImageFont.truetype(FD + n, s)
FT, FS, FNUM = F("TY-Alexandria-800.ttf", 46), F("TY-Alexandria-500.ttf", 34), F("TY-InstrumentSerif-Italic.ttf", 52)
GOLD = (214, 178, 106); CH = 1460
def tooth_icon(d, cx, cy, r, col, w):
    pts = [(-.62, -.55), (-.35, -.8), (0, -.62), (.35, -.8), (.62, -.55), (.6, .05), (.42, .78), (.2, .8), (.08, .25), (-.08, .25), (-.2, .8), (-.42, .78), (-.6, .05), (-.62, -.55)]
    d.line([(cx + x * r, cy + y * r) for x, y in pts], fill=col, width=w, joint="curve")
# جدول البطاقة: نسبة العرض للطول لكل نوع سنة (محسوبة من صورة الحالة نفسها)
def ratios(sh):
    r = {}
    for k in (1, 2, 3):
        ts = [t for t in sh.six if t["fdi"] % 10 == k]; r[k] = np.mean([sh.pct[id(t)] for t in ts])
    return r
R = ratios(S2)
def card_img(side):
    cw, ch = 470, CH; im = Image.new("RGBA", (cw, ch)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, cw - 1, ch - 1), 40, fill=(14, 14, 16, 250), outline=(70, 70, 75, 255), width=2)
    if side == 0:   # الوش: اسم العيادة
        oy = (CH - 920) / 2; d.ellipse((cw / 2 - 70, 250 + oy, cw / 2 + 70, 390 + oy), outline=GOLD, width=4)
        tooth_icon(d, cw / 2, 320 + oy, 48, GOLD, 4)
        f = FT
        while d.textlength(CLINIC, font=f, direction="rtl") > cw - 60: f = f.font_variant(size=f.size - 2)   # الاسم لازم يدخل في البطاقة
        d.text((cw / 2, 470 + oy), CLINIC, font=f, fill=GOLD, anchor="mm", direction="rtl")
        d.text((cw / 2, 535 + oy), "تصميم الابتسامة", font=FS, fill=(200, 200, 200), anchor="mm", direction="rtl")
    else:           # الضهر: الجدول + مسطرة
        oy = (CH - 920) / 2
        d.text((cw / 2 - 10, 80 + oy), "نصيب كل سن", font=FS, fill=(235, 235, 235), anchor="mm", direction="rtl")
        d.text((cw / 2 - 10, 122 + oy), "من عرض الابتسامة", font=F("TY-Alexandria-500.ttf", 28), fill=(170, 170, 170), anchor="mm", direction="rtl")
        rows = [("الثنية", R[1]), ("الرباعية", R[2]), ("الناب", R[3])]
        for i, (n, v) in enumerate(rows):
            y = 200 + oy + i * 150; d.rounded_rectangle((60, y - 55, cw - 70, y + 55), 18, outline=(120, 120, 125), width=2)
            d.text((cw - 100, y), n, font=FS, fill="white", anchor="rm", direction="rtl"); d.text((110, y), f"{v:.1f}%", font=FNUM, fill=GOLD, anchor="lm")
        d.text((cw / 2, 680 + oy), "محسوبة من صور الحالة", font=F("TY-Alexandria-500.ttf", 26), fill=(150, 150, 150), anchor="mm", direction="rtl")
        for k, y in enumerate(range(40, ch - 40, 10)):   # مسطرة على الحافة
            L = 30 if k % 10 == 0 else 18 if k % 5 == 0 else 10; d.line([(cw - 1 - L, y), (cw - 1, y)], fill=(220, 220, 220), width=2)
    return im
CARD = [card_img(0), card_img(1)]
GUM = [(40, 90, 255), (255, 220, 40), (255, 40, 40), (40, 230, 70), (255, 140, 30), (160, 70, 255)]   # ألوان خط اللثة (زي الأصل)
def gum_pts(sh, t, z):
    c = t["c"]; top = c[c[:, 1] < t["y"] + t["h"] * .32]
    top = top[np.argsort(top[:, 0])]; return [sh.tf(x, y, z) for x, y in top[::2]]
def incisal_x(sh, z):   # أبعد نقطة للحافة القاطعة للصف العلوي في الفريم (ناحية الشمال)
    return min(sh.tf(x, y, z)[0] for t in sh.six for x, y in t["c"][::4])
def scene1(t):   # 0 → 5.2
    z = 1.0 + .04 * t / 5.2; fr = S1.base(z).convert("RGBA")
    xi = incisal_x(S1, z); X0 = xi - 470 - 28   # البطاقة تقف قبل السنان العلوية بمسافة، وتغطي السفلية
    xin = ease(t / .6); flip = min(1, max(0, (t - 1.1) / .6))
    sx = abs(np.cos(flip * np.pi)); side = 0 if flip < .5 else 1
    cd = CARD[side].resize((max(2, int(470 * sx)), CH)); x = -520 + (X0 + 520) * xin + (470 - cd.width) / 2; y = (FH - CH) / 2
    ov = Image.new("RGBA", fr.size); ov.alpha_composite(cd, (int(x), int(y)))
    d = ImageDraw.Draw(ov)
    for i, tt in enumerate(S1.six):
        p = ease((t - 2.0 - i * .2) / .7)
        if p > 0:
            pts = [S1.tf(px, py, z) for px, py in tt["c"][::2]] + [S1.tf(*tt["c"][0], z)]; d.line(anim.partial(pts, p), fill=(255, 255, 255, 230), width=3)
    sh = Image.new("RGBA", fr.size); ImageDraw.Draw(sh).rounded_rectangle((int(x) + 12, int(y) + 18, int(x) + cd.width + 12, int(y) + CH + 18), 40, fill=(0, 0, 0, 120))
    fr = Image.alpha_composite(fr, sh.filter(ImageFilter.GaussianBlur(14))); return Image.alpha_composite(fr, ov).convert("RGB")
LBL = [("المنطقة الشفافة", .82, "inc"), ("الهالة القاطعة", .99, "inc"), ("حافة اللثة", .04, "gum")]
def scene2(u):   # 0 → 5.6
    z = 1.04 + .04 * u / 5.6; fr = S2.base(z, 1.0).convert("RGBA"); gl = Image.new("RGBA", fr.size); g = ImageDraw.Draw(gl); ov = Image.new("RGBA", fr.size); d = ImageDraw.Draw(ov)
    fade = 1 - ease((u - 4.8) / .6)
    six = sorted(S2.six, key=lambda t: t["cx"])
    for i, tt in enumerate(six):   # خط لثة ملون لكل سنة
        p = ease((u - .3 - i * .15) / .6)
        if p <= 0: continue
        pts = anim.partial(gum_pts(S2, tt, z), p); col = GUM[i] + (int(255 * fade),)
        g.line(pts, fill=col, width=26); d.line(pts, fill=col, width=7)
    c11 = [t for t in S2.six if t["fdi"] == 11][0]
    for j, (txt, fy, kind) in enumerate(LBL):
        p = ease((u - 2.2 - j * .45) / .5)
        if p <= 0: continue
        px, py = S2.tf(c11["cx"], c11["y"] + c11["h"] * fy, z); a = int(255 * p * fade)
        tx, anchor = 60, "lm"; ty = [FH * .3, FH * .42, FH * .7][j]
        d.ellipse((px - 8, py - 8, px + 8, py + 8), fill=(255, 255, 255, a)); d.line([(px, py), (tx + 330, ty), (tx, ty)], fill=(255, 255, 255, a), width=2)
        d.text((tx, ty - 30), txt, font=FS, fill=(255, 255, 255, a), anchor=anchor, direction="rtl", stroke_width=3, stroke_fill=(0, 0, 0, a))
    fr = Image.alpha_composite(fr, gl.filter(ImageFilter.GaussianBlur(12))); return Image.alpha_composite(fr, ov).convert("RGB")
def scene3(v):   # الشعار
    im = Image.new("RGB", (FW, FH), (6, 6, 7)); d = ImageDraw.Draw(im); p = ease(v / .6)
    col = tuple(int(c * p) for c in GOLD)
    d.ellipse((FW / 2 - 90, 690, FW / 2 + 90, 870), outline=col, width=5); tooth_icon(d, FW / 2, 780, 60, col, 5)
    d.text((FW / 2, 960), CLINIC, font=F("TY-Alexandria-800.ttf", 72), fill=col, anchor="mm", direction="rtl")
    d.text((FW / 2, 1050), DOC, font=F("TY-Alexandria-500.ttf", 44), fill=tuple(int(200 * p) for _ in range(3)), anchor="mm", direction="rtl")
    gx = -300 + (FW + 600) * min(1, max(0, (v - .7) / 1.0))   # لمعة بتعدّي
    sh = Image.new("L", (FW, FH)); ImageDraw.Draw(sh).polygon([(gx, 600), (gx + 90, 600), (gx - 110, 1120), (gx - 200, 1120)], fill=150)
    return Image.composite(Image.new("RGB", (FW, FH), (255, 240, 200)), im, Image.fromarray(np.minimum(np.array(sh), (np.array(im.convert("L")) > 40) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6)))
T1, T2 = 5.2, 10.8; T3 = T2 + 4.0; T4 = T3 + 1.6; DUR = T4 + 2.6
import cv2
class Art:
    def __init__(s, p):
        s.p = subprocess.Popen(["ffmpeg", "-v", "quiet", "-i", p, "-vf", f"fps={FPS},scale={FW}:{FH}:flags=lanczos", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE); s.last = None
    def next(s):
        b = s.p.stdout.read(FW * FH * 3)
        if len(b) == FW * FH * 3: s.last = Image.frombytes("RGB", (FW, FH), b)
        return s.last
ART = None
def teeth_dist(sh, z):   # بُعد كل بكسل عن السنان العلوية (عشان الفاصل يكبر منها)
    m = np.zeros((FH, FW), np.uint8)
    for tt in sh.six: cv2.fillPoly(m, [np.array([sh.tf(x, y, z) for x, y in tt["c"][::2]], np.int32)], 255)
    return cv2.distanceTransform(255 - m, cv2.DIST_L2, 5)
DIST = {}
def reveal(base, art, r):   # الفن يبان جوه السنان ويتمدد لحد نصف قطر r
    key = id(base.__class__)
    d = DIST["d"]; a = np.clip((r - d) / 40.0, 0, 1)[..., None]
    return Image.fromarray((np.array(art) * a + np.array(base) * (1 - a)).astype(np.uint8))
def back(w):
    z = 1.08; fr = S2.base(z, 1.0).convert("RGBA"); ov = Image.new("RGBA", fr.size); d = ImageDraw.Draw(ov)
    for tt in S2.six:
        if tt["fdi"] % 10 == 1:
            pts = [S2.tf(px, py, z) for px, py in tt["c"][::2]] + [S2.tf(*tt["c"][0], z)]; d.line(anim.partial(pts, ease(w / 1.0)), fill=(255, 255, 255, 230), width=3)
    return Image.alpha_composite(fr, ov).convert("RGB")
RMAX = 1400
def frame(t):
    global ART
    if T2 - 1.2 <= t < T3:
        if ART is None: ART = Art("art/art.mp4"); DIST["d"] = teeth_dist(S2, 1.04 + .04 * min(1, (T2 - T1) / 5.6)); globals()["RMAX"] = float(DIST["d"].max()) + 60
        a = ART.next()
        if t < T2:   # دخول: الفن يبان جوه السنان الأول، وبعدين يكبر ويملا الشاشة
            u = (t - (T2 - 1.2)) / 1.2; r = 0 if u < .45 else ease((u - .45) / .55) * RMAX
            base = scene2(t - T1)
            if u < .45:
                ins = np.clip(-DIST["d"] / 1 + 1, 0, 1)[..., None] * ease(u / .45)
                return Image.fromarray((np.array(a) * ins + np.array(base) * (1 - ins)).astype(np.uint8))
            return reveal(base, a, r)
        if t > T3 - 1.2:   # خروج بالعكس: الفن يتقلص لجوه السنان وبعدين يختفي
            u = (t - (T3 - 1.2)) / 1.2; bk = back(0)
            if u < .55: return reveal(bk, a, (1 - ease(u / .55)) * RMAX)
            ins = np.clip(-DIST["d"] / 1 + 1, 0, 1)[..., None] * (1 - ease((u - .55) / .45))
            return Image.fromarray((np.array(a) * ins + np.array(bk) * (1 - ins)).astype(np.uint8))
        return a
    if T3 <= t < T4: return back(t - T3)
    if t < T1:
        im = scene1(t)
        return Image.blend(im, Image.new("RGB", im.size), (t - (T1 - .3)) / .3) if t > T1 - .3 else im
    if t < T2:
        im = scene2(t - T1)
        if t < T1 + .3: im = Image.blend(Image.new("RGB", im.size), im, (t - T1) / .3)
        return im
    im = scene3(t - T4)
    return Image.blend(back(1.6), im, (t - T4) / .4) if t < T4 + .4 else im
if __name__ == "__main__":
    if "--still" in sys.argv:
        for tt in [x / FPS for x in range(int(9.55 * FPS))]: pass
        for tt in (4.8, 9.9, 10.5, 13.0, 14.4): frame(tt).save(f"cd_{tt}.jpg")
        raise SystemExit
    cmd = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{FW}x{FH}", "-r", str(FPS), "-i", "-", "-ss", str(MOFF), "-i", MUSIC,
           "-filter_complex", f"[1:a]atrim=0:{DUR},asetpts=PTS-STARTPTS,afade=t=in:d=0.4,afade=t=out:st={DUR - 1.2}:d=1.2,loudnorm=I=-14:TP=-1.5[a]", "-map", "0:v", "-map", "[a]",
           "-c:a", "aac", "-b:a", "192k", "-c:v", "libx264", "-crf", "19", "-preset", "medium", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-t", str(DUR), OUT]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(int(DUR * FPS)): p.stdin.write(frame(i / FPS).tobytes())
    p.stdin.close(); p.wait(); print("done", OUT, R)

