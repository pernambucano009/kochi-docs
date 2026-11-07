"""مكتبة القوالب: أصول الحالة الحقيقية + أدوات الرسم والمورف والتحليل + محرك الإخراج + المقارنة بالأصل.
كل قالب = قائمة مشاهد (المدة، دالة ترجع فريم)."""
import sys, os, subprocess, numpy as np, cv2, math
S = ((__import__("os").environ.get("DENTAL_ROOT") or __import__("os").path.dirname(__import__("os").path.dirname(__import__("os").path.abspath(__file__)))) + "/")
sys.path.insert(0, S + "ana"); os.chdir(S + "ana")
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps, ImageEnhance
import anim
from anim import Shot, ease, FW, FH, FPS, FD
CASE_DIR = os.environ.get("CASE_DIR")   # فولدر الحالة (product/): canon/ = الصور بأسماء ثابتة، ana/ = تحليل السنان، elements/ = العناصر المعتمدة
C = (CASE_DIR + "/canon/") if CASE_DIR else S + "case1/"; AN = (CASE_DIR + "/ana/") if CASE_DIR else ""   # AN فاضي = ملفات التحليل في ana/ زي ما هي
G = S + "tpl/g/"; OUTD = (CASE_DIR + "/out/") if CASE_DIR else S + "tpl/out/"; os.makedirs(OUTD, exist_ok=True)
DOC = "د. إسلام جمعة"; CLINIC = "عيادة د. إسلام جمعة"; GOLD = (214, 178, 106)
F = lambda n, s: ImageFont.truetype(FD + n, s)
FA, FA5, FRQ, FSER = "TY-Alexandria-800.ttf", "TY-Alexandria-500.ttf", "TY-ArefRuqaa-700.ttf", "TY-InstrumentSerif-Italic.ttf"
L = lambda p: Image.open(p).convert("RGB")
# ---------- أصول الحالة ----------
BF = L(C + "before/face.webp"); BM = L(C + "before/macro.jpg")
# الصور الاختيارية (أقرب/جانبية): لو الطبيب مارفعهاش نستخدم الأمامية الحقيقية بدلها (الحالة ماتقعش بسبب صورة مش موجودة)
Lo = lambda p, alt: L(p if os.path.exists(p) else alt)
AF = L(C + "after/front.jpg"); AC = Lo(C + "after/front_close.jpg", C + "after/front.jpg")
AS1 = Lo(C + "after/side1.jpg", C + "after/front.jpg"); AS2 = Lo(C + "after/side2.jpg", C + "after/side1.jpg" if os.path.exists(C + "after/side1.jpg") else C + "after/front.jpg")
SF = L(C + "ret/smile_front_ret4.jpg")
SR, SL = [Lo(C + f"ret/{n}_ret4.jpg", C + "ret/smile_front_ret4.jpg") for n in ("smile_side_r", "smile_side_l")]
_shots = {}
def shot(n):
    if n not in _shots:
        _shots[n] = {"B": lambda: Shot(C + "before/macro.jpg", AN + "ai_before.png", AN + "lab_before.json"),
                     "A": lambda: Shot(C + "after/front.jpg", AN + "ai_after.png", AN + "lab_after.json"),
                     "S": lambda: Shot(C + "ret/smile_front_ret4.jpg", AN + "ai_smile.png", AN + "lab_smile.json")}[n]()
    return _shots[n]
# ---------- أدوات صورة ----------
def cover(im, z=1.0, cx=.5, cy=.5, W=FW, H=FH):
    s = max(W / im.width, H / im.height) * z; w, h = W / s, H / s
    x = (im.width - w) * cx; y = (im.height - h) * cy
    return im.crop((int(x), int(y), int(x + w), int(y + h))).resize((W, H), Image.BICUBIC)
def rot(im): return im.transpose(Image.Transpose.ROTATE_270)   # فوق → يمين (زي المراجع)
def bw(im): return ImageOps.grayscale(im).convert("RGB")
def blend(a, b, p): return Image.blend(a, b, max(0, min(1, p)))
def black(W=FW, H=FH): return Image.new("RGB", (W, H), (0, 0, 0))
def flash(im, p, col=(255, 255, 255)): return Image.blend(im, Image.new("RGB", im.size, col), max(0, min(1, p)))
def txt(im, xy, s, size=56, font=FA, fill=(255, 255, 255), anchor="mm", stroke=3, alpha=1.0, rtl=True):
    lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay)
    d.text(xy, s, font=F(font, size), fill=fill + (int(255 * alpha),), anchor=anchor, direction="rtl" if rtl else None, stroke_width=stroke, stroke_fill=(0, 0, 0, int(170 * alpha)))
    return Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")
def chip(im, s, y=110, alpha=1.0):
    lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay); f = F(FA, 46); w = d.textlength(s, font=f, direction="rtl") + 80
    d.rounded_rectangle((im.width / 2 - w / 2, y - 42, im.width / 2 + w / 2, y + 42), 42, fill=(0, 0, 0, int(140 * alpha)))
    d.text((im.width / 2, y), s, font=f, fill=(255, 255, 255, int(255 * alpha)), anchor="mm", direction="rtl")
    return Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")
def tooth_icon(d, cx, cy, r, col, w):
    pts = [(-.62, -.55), (-.35, -.8), (0, -.62), (.35, -.8), (.62, -.55), (.6, .05), (.42, .78), (.2, .8), (.08, .25), (-.08, .25), (-.2, .8), (-.42, .78), (-.6, .05), (-.62, -.55)]
    d.line([(cx + x * r, cy + y * r) for x, y in pts], fill=col, width=w, joint="curve")
def zoomc(im, z, cx=.5, cy=.5):   # تقريب من نص الكادر (أو نقطة) من غير حواف — للدفع البطيء للكاميرا
    if z <= 1.0005: return im
    W_, H_ = im.size; w, h = W_ / z, H_ / z; x0 = min(max(0, W_ * cx - w / 2), W_ - w); y0 = min(max(0, H_ * cy - h / 2), H_ - h)
    return im.resize((W_, H_), Image.BICUBIC, box=(x0, y0, x0 + w, y0 + h))
def right_gap(im, thr=24):   # قد إيه فراغ إسود بين آخر اللثة/السنان وحافة الشاشة اليمين
    a = np.asarray(im.convert("L")); cols = np.where((a > thr).sum(0) > a.shape[0] * .02)[0]
    return int(a.shape[1] - 1 - cols.max()) if len(cols) else 0
def shift_x(im, dx):   # زق الصورة يمين (الفراغ يتملي إسود من الشمال)
    if dx <= 0: return im
    out = Image.new("RGB", im.size, (0, 0, 0)); out.paste(im.crop((0, 0, im.width - dx, im.height)), (dx, 0)); return out
def gum_extend(im, thr=24, band=(16, 6)):
    """أداة عامة: اللثة حافتها مقوّسة، فبعد ما الصورة تتزق يمين بيفضل فراغ إسود بين القوس وحافة الشاشة.
    بنكمّل كل صف من حافة اللثة لحد آخر الشاشة بشريحة رفيعة من جوه اللثة نفسها (لونها وملمسها، من غير الحد الغامق ولا السنان)،
    وبعدين تنعيم رأسي خفيف للحتة المضافة بس علشان مايبانش تكرار."""
    a = np.asarray(im).copy(); H, W = a.shape[:2]; g = a.max(2) > thr; fill = np.zeros((H, W), bool)
    for y in np.where(g.any(1))[0]:
        xr = np.where(g[y])[0][-1]
        if xr >= W - 2 or xr < W * .45: continue
        s0, s1 = xr - band[0], xr - band[1]
        if s0 < 0: continue
        strip = a[y, s0:s1]; n = W - (s1)
        reps = np.tile(strip[::-1] if (y // 7) % 2 else strip, (n // len(strip) + 2, 1))[:n]
        a[y, s1:W] = reps; fill[y, s1:W] = True
    if fill.any():
        b = cv2.GaussianBlur(a, (0, 0), sigmaX=2.5, sigmaY=6); m = cv2.GaussianBlur(fill.astype(np.float32), (0, 0), 3)[..., None]
        a = (a * (1 - m) + b * m).astype(np.uint8)
    return Image.fromarray(a)
def right_fit(im, thr=24, rows=(.12, .88), pad=4):
    """قد إيه نزق ونكبّر علشان اللثة كلها (حتى أضيق نقطة في قوسها) توصل لحافة الشاشة اليمين: (dx, k)."""
    a = np.asarray(im.convert("L")); H, W = a.shape; g = a > thr
    ys = range(int(H * rows[0]), int(H * rows[1])); xr = [np.where(g[y])[0][-1] for y in ys if g[y].any()]
    cols = np.where(g.sum(0) > H * .02)[0]
    if not xr or not len(cols): return 0, 1.0
    xl = cols.min(); xmin = min(xr); k = max(1.0, (W - 1 - xl) / max(1, (xmin - xl)) )
    return xl, min(1.12, k * (1 + pad / W))   # حد أقصى 12% علشان مانقصّش السنان
def fit_right_img(im, xl, k):   # تكبير حوالين الطرف الشمال للأسنان (نقطة xl في نص الارتفاع) لحد ما اللثة تلزق يمين
    if k <= 1.0005: return im
    W, H = im.size; w, h = W / k, H / k; x0 = xl - xl / k; y0 = H / 2 - h / 2
    return im.resize((W, H), Image.BICUBIC, box=(x0, y0, x0 + w, y0 + h))
def gum_fill(im, back, thr=24, feather=4, rim=9):
    """أداة عامة: الفراغ الإسود يمين اللثة (بعد حافتها المقوّسة) بيتملي من خلفية لثة ممتدة معمولة مرة واحدة.
    السنان واللثة الحقيقية مابتتغيرش؛ الخلفية بتظهر في الفراغ بس + كام بكسل على حافة اللثة الغامقة (rim) علشان مايبانش خط.
    الصفوف اللي فوق وتحت الفك (من غير محتوى) بتتملي في النص اليمين بس."""
    a = np.asarray(im).astype(np.float32); H, W = a.shape[:2]; b = np.asarray(back.convert("RGB").resize((W, H))).astype(np.float32).copy()
    ok = np.where(b[:, int(W * .8):].max(2).mean(1) > 40)[0]   # صفوف الخلفية اللي فيها لثة فعلًا — فوقها وتحتها بيتكرر آخر صف (مايبقاش فيه ركن إسود)
    if len(ok): b[:ok[0]] = b[ok[0]]; b[ok[-1] + 1:] = b[ok[-1]]
    g = a.max(2) > thr; m = np.zeros((H, W), np.float32); rows = np.where(g.any(1))[0]
    if not len(rows): return im
    xmid = int(np.median([np.where(g[y])[0][-1] for y in rows]))
    for y in range(H):
        if g[y].any(): xr = np.where(g[y])[0][-1]; m[y, max(0, xr - rim):] = 1.0
        # الصفوف اللي مافيهاش فك خالص (فوقه وتحته) بتفضل إسود زي باقي الخلفية
    m = cv2.GaussianBlur(m, (0, 0), feather)[..., None]
    return Image.fromarray((a * (1 - m) + b * m).astype(np.uint8))
def flush_right(fn, t0=0.0, pad=6, extend=True, back=None, dx=None):   # أداة عامة: مشهد الفك المعزول يتزق يمين لحد ما اللثة تلزق في حافة الشاشة (من غير فراغ إسود)
    """back: خلفية لثة ممتدة (صورة، أو دالة t ← صورة) — الفراغ اللي بعد قوس اللثة بيتملي منها (gum_fill).
    من غيرها: تكبير بسيط (حد أقصى 12%) وده مش دايمًا بيقفل الفراغ."""
    st = {}
    def g(t):
        if "dx" not in st:
            st["dx"] = dx if dx is not None else right_gap(fn(t0)) + pad; st["fit"] = right_fit(shift_x(fn(t0), st["dx"]))
        out = shift_x(fn(t), st["dx"])
        if back is not None: return gum_fill(out, back(t) if callable(back) else back)
        return fit_right_img(out, *st["fit"]) if extend else out
    return g
def push(fn, dur, k=.05, cx=.5, cy=.5):   # لقطة ثابتة ← دفع كاميرا بطيء طول المشهد (الأصل مافيهوش لقطات متجمدة)
    return lambda t: zoomc(fn(t), 1 + k * ease(min(1, t / dur)) * .4 + k * .6 * min(1, t / dur), cx, cy)
def logo(v, W=FW, H=FH):   # شعار العيادة (مؤقت لحد ما الطبيب يرفع شعاره) + لمعة
    im = Image.new("RGB", (W, H), (6, 6, 7)); d = ImageDraw.Draw(im); p = ease(v / .6); col = tuple(int(c * p) for c in GOLD); cy = H / 2
    d.ellipse((W / 2 - 90, cy - 230, W / 2 + 90, cy - 50), outline=col, width=5); tooth_icon(d, W / 2, cy - 140, 60, col, 5)
    d.text((W / 2, cy + 40), CLINIC, font=F(FA, 66 if W > 900 else 50), fill=col, anchor="mm", direction="rtl")
    d.text((W / 2, cy + 125), DOC, font=F(FA5, 42), fill=tuple(int(200 * p) for _ in range(3)), anchor="mm", direction="rtl")
    gx = -300 + (W + 600) * min(1, max(0, (v - .7) / 1.0)); sh = Image.new("L", (W, H))
    ImageDraw.Draw(sh).polygon([(gx, cy - 260), (gx + 90, cy - 260), (gx - 110, cy + 180), (gx - 200, cy + 180)], fill=150)
    m = Image.fromarray(np.minimum(np.array(sh), (np.array(im.convert("L")) > 40) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))
    return zoomc(Image.composite(Image.new("RGB", (W, H), (255, 240, 200)), im, m), 1 + .05 * min(1, v / 3.5))   # الشعار بيقرّب ببطء
def signature(im, p, y=None, W=FW):   # توقيع الطبيب بالخط العربي (رقعة) يُكتب من اليمين
    y = y or im.height * .86; lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay); f = F(FRQ, 110)
    d.text((W / 2, y), DOC, font=f, fill=(255, 255, 255, 255), anchor="mm", direction="rtl", stroke_width=2, stroke_fill=(0, 0, 0, 120))
    tw = d.textlength(DOC, font=f, direction="rtl"); x0 = W / 2 + tw / 2 - tw * ease(p)
    m = Image.new("L", im.size, 0); ImageDraw.Draw(m).rectangle((x0, 0, W, im.height), fill=255)
    lay.putalpha(Image.fromarray(np.minimum(np.array(lay.split()[3]), np.array(m))))
    return Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")
def slot(label, sub="", W=FW, H=FH, t=0):   # مكان لقطة يصوّرها الطبيب (لسه مش عندنا)
    im = Image.new("RGB", (W, H), (22, 24, 28)); d = ImageDraw.Draw(im)
    for i in range(0, 2 * (W + H), 60): d.line([(i, 0), (i - H, H)], fill=(30, 33, 38), width=18)
    m = 60; dash = 26
    for x in range(m, W - m, dash * 2): d.line([(x, m), (x + dash, m)], fill=GOLD, width=4); d.line([(x, H - m), (x + dash, H - m)], fill=GOLD, width=4)
    for y in range(m, H - m, dash * 2): d.line([(m, y), (m, y + dash)], fill=GOLD, width=4); d.line([(W - m, y), (W - m, y + dash)], fill=GOLD, width=4)
    cy = H / 2 - 120; d.ellipse((W / 2 - 80, cy - 80, W / 2 + 80, cy + 80), outline=GOLD, width=5)
    d.rectangle((W / 2 - 40, cy - 22, W / 2 + 28, cy + 26), outline=GOLD, width=5); d.polygon([(W / 2 + 28, cy - 10), (W / 2 + 52, cy - 24), (W / 2 + 52, cy + 28), (W / 2 + 28, cy + 14)], outline=GOLD, width=4)
    d.text((W / 2, cy + 160), "لقطة يصوّرها الطبيب", font=F(FA5, 40), fill=(170, 170, 170), anchor="mm", direction="rtl")
    f = F(FA, 56)
    while d.textlength(label, font=f, direction="rtl") > W - 180: f = f.font_variant(size=f.size - 2)
    d.text((W / 2, cy + 240), label, font=f, fill=(255, 255, 255), anchor="mm", direction="rtl")
    if sub: d.text((W / 2, cy + 315), sub, font=F(FA5, 36), fill=(170, 170, 170), anchor="mm", direction="rtl")
    return im
# ---------- السنان: حدود، نسب، مورف ----------
def outlines(im, sh, z, p=1.0, col=(255, 255, 255), width=3, which="six", glow=False, stagger=.15):
    lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay); teeth = sh.six if which == "six" else [t for t in sh.teeth_all if t["fdi"] < 30]
    teeth = sorted(teeth, key=lambda t: (t["fdi"] % 10, t["cx"]))
    for i, t in enumerate(teeth):
        q = ease((p * (1 + stagger * len(teeth)) - i * stagger))
        if q <= 0: continue
        pts = [sh.tf(x, y, z) for x, y in t["c"][::2]] + [sh.tf(*t["c"][0], z)]; c = col(t) if callable(col) else col
        d.line(anim.partial(pts, q), fill=c + (255,), width=width)
    out = lay.filter(ImageFilter.GaussianBlur(8)) if glow else None
    base = im.convert("RGBA")
    if glow: base = Image.alpha_composite(base, out)
    return Image.alpha_composite(base, lay).convert("RGB")
def pct_labels(im, sh, z, p=1.0, font=FSER, size=70):
    lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay)
    for i, t in enumerate(sorted(sh.six, key=lambda q: q["fdi"] % 10)):
        q = ease((p * 1.6 - i * .12) / .4)
        if q <= 0: continue
        cx, cy = sh.tf(t["cx"], t["y"] + t["h"] * .45, z); d.text((cx, cy), f"{sh.pct[id(t)]:.1f}%", font=F(font, size), fill=(255, 255, 255, int(255 * q)), anchor="mm", stroke_width=max(2, size // 22), stroke_fill=(40, 30, 25, int(200 * q)))
    return Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")
_M = {}
def dehair(img, protect):
    """أداة عامة: تشيل الشعر/الخيوط الغامقة الرفيعة (شنب، شعر الشفة) من على اللثة في الصور المعزولة — من غير ما تلمس السنان."""
    a = np.clip(img, 0, 255).astype(np.uint8); Lc = cv2.cvtColor(a, cv2.COLOR_RGB2LAB)[..., 0]
    bh = cv2.morphologyEx(Lc, cv2.MORPH_BLACKHAT, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21)))
    hm = ((bh > 12) & (Lc < 165) & (protect == 0)).astype(np.uint8) * 255
    hm = cv2.dilate(hm, np.ones((5, 5), np.uint8))
    if hm.sum() == 0: return img
    return cv2.inpaint(a, hm, 5, cv2.INPAINT_TELEA).astype(np.float32)
def morph_setup():   # صورة البعد متطابقة على القبل + قناع كل سنة
    if not _M:
        from align import pair
        ib, wa, masks, common, M = pair(); r = lambda a: np.ascontiguousarray(np.rot90(a, -1))
        _M.update(RB=r(cv2.cvtColor(ib, cv2.COLOR_BGR2RGB)).astype(np.float32), RA=r(cv2.cvtColor(wa, cv2.COLOR_BGR2RGB)).astype(np.float32),
                  RM={k: r(m).astype(np.float32) / 255 for k, m in masks.items()}, common=common,
                  FB=cv2.cvtColor(ib, cv2.COLOR_BGR2RGB).astype(np.float32), FA_=cv2.cvtColor(wa, cv2.COLOR_BGR2RGB).astype(np.float32),
                  FM={k: m.astype(np.float32) / 255 for k, m in masks.items()}, M=M)
        At = {t["fdi"]: t for t in shot("A").teeth_all}; common = [k for k in common if k in At]
        _M["planned"] = {k: cv2.transform(At[k]["c"].reshape(-1, 1, 2).astype(np.float32), M).reshape(-1, 2) for k in common}   # شكل البعد على صورة القبل
        B = shot("B"); Bt = {t["fdi"]: t for t in B.teeth_all}
        up_ = [k for k in common if k < 30]; M_up = up_
        tm = np.zeros(ib.shape[:2], np.uint8)   # السنان (قبل + بعد) محمية تماماً: التنضيف على اللثة والشفايف بس
        for t_ in B.teeth_all: cv2.fillPoly(tm, [t_["c"].astype(np.int32)], 255)
        for k in common: cv2.fillPoly(tm, [_M["planned"][k].astype(np.int32)], 255)
        tm = cv2.dilate(tm, np.ones((15, 15), np.uint8))
        for kk in ("FB", "FA_"): _M[kk] = dehair(_M[kk], tm)
        _M["RB"], _M["RA"] = r(_M["FB"]), r(_M["FA_"])
        own = []
        for k in up_:   # حدود سنان القبل نفسها بس (مش المدموجة مع البعد) عشان مايدخلش أطراف السنان السفلية
            mm = np.zeros(ib.shape[:2], np.uint8); cv2.fillPoly(mm, [Bt[k]["c"].astype(np.int32)], 255); own.append(mm)
        isoB = anim.iso_mask(ib, own, src=C + "before/macro.jpg"); allm = np.zeros_like(isoB)
        for k in up_: allm = np.maximum(allm, masks[k])
        top_lower = min(t["y"] for t in B.teeth_all if t["fdi"] > 30)
        allm[top_lower + 25:] = 0 if False else allm[top_lower + 25:]
        B.iso = Image.fromarray(r(isoB)); _M["isoB"] = isoB; _M["shape"] = ib.shape[:2]
        xs = [Bt[k]["x"] for k in up_] + [Bt[k]["x"] + Bt[k]["w"] for k in up_]; span = (max(xs) - min(xs)) * 1.12
        B.ch = span; B.cw = span * FW / FH; B.cY = (max(xs) + min(xs)) / 2; _M["order"] = sorted(up_, key=lambda k: Bt[k]["cx"]); _M["lower"] = [k for k in common if k > 30]
    return _M
_SM = {}
def shape_morph():
    if "sm" not in _SM:
        from morph import ShapeMorph
        M = morph_setup(); Bt = {t["fdi"]: t for t in shot("B").teeth_all}
        _SM["sm"] = ShapeMorph(M["FB"], M["FA_"], {k: Bt[k]["c"] for k in M["common"]}, {k: M["planned"][k] for k in M["common"]})
    return _SM["sm"]
def current_contours(prog):   # حدود السنان زي ما هي ظاهرة دلوقتي (عشان الخطوط تبقى على السنان نفسها)
    sm = shape_morph(); out = {}
    for k in sm.keys:
        p = prog if isinstance(prog, (int, float)) else prog.get(k, 0); out[k] = sm.contour(k, max(0, min(1, p)))
    return out
def morph_img(prog, rotated=True, flash_t=None):
    """المورف الحقيقي: شكل كل سنة بيتحول في مكانها (مش مزج)."""
    f = shape_morph().frame(prog); im = Image.fromarray(np.clip(f, 0, 255).astype(np.uint8))
    return rot(im) if rotated else im
def morph_img_old(prog, rotated=True, flash_t=None):
    """prog: dict سنة→تقدّم 0..1 (أو رقم واحد لكل السنان). يرجّع صورة القبل وفيها السنان المتحولة لصورة البعد الحقيقية."""
    M = morph_setup(); RB, RA, RM = (M["RB"], M["RA"], M["RM"]) if rotated else (M["FB"], M["FA_"], M["FM"])
    al = np.zeros(RB.shape[:2], np.float32)
    for k in M["common"]:
        p = prog if isinstance(prog, (int, float)) else prog.get(k, 0)
        if p > 0: al = np.maximum(al, RM[k] * p)
    comp = RB * (1 - al[..., None]) + RA * al[..., None]
    return Image.fromarray(np.clip(comp, 0, 255).astype(np.uint8))
def morph_outlines(im, prog, z=1.0, p=1.0, col=(255, 255, 255), width=3):
    B = shot("B"); lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay); cc = current_contours(prog); M = morph_setup()
    for i, k in enumerate(M["order"]):
        q = ease(p * 1.4 - i * .05)
        if q <= 0: continue
        pts = [B.tf(x, y, z) for x, y in cc[k][::1]]; pts.append(pts[0]); d.line(anim.partial(pts, q), fill=col + (255,), width=width)
    return Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")
def morph_frame(prog, z=1.0, iso=1.0):
    """العزل بيتبع شكل السنان في اللحظة دي: (عزل القبل) + (شكل كل سنة دلوقتي)."""
    B = shot("B"); M = morph_setup()
    if not hasattr(B, "_img0"): B._img0, B._iso0 = B.img, B.iso   # صورة القبل الأصلية (ملاحظة a30 5.6: المورف كان بيسيب صورة القبل المشتركة متغيرة للبعد، فأي مشهد قبل بعده طلع بسنان بيضا)
    B.img = morph_img(prog)
    try:
        if iso > 0:
            m = M["isoB"].copy(); cc = current_contours(prog); cur = np.zeros_like(m)
            for k, c in cc.items():
                if k < 30: cv2.fillPoly(cur, [c.astype(np.int32)], 255)
            m = np.maximum(m, cv2.GaussianBlur(cur, (0, 0), 1.5)); B.iso = Image.fromarray(np.ascontiguousarray(np.rot90(m, -1)))
        return B.base(z, iso)
    finally: B.img, B.iso = B._img0, B._iso0   # يرجع القبل الحقيقي لأي حد بعده
def planned(im, z, p=1.0, col=(255, 255, 255), width=3, dashed=True, fill=None, only_added=False):
    """يرسم شكل السنان بعد العلاج فوق صورة القبل (من صورة البعد الحقيقية المتطابقة)."""
    M = morph_setup(); B = shot("B"); lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay)
    Bt = {t["fdi"]: t for t in B.teeth_all}
    for i, k in enumerate(M["order"]):
        q = ease(p * 1.5 - i * .06)
        if q <= 0: continue
        pts = [B.tf(x, y, z) for x, y in M["planned"][k][::2]]; pts.append(pts[0])
        if fill:
            m1 = Image.new("L", im.size); ImageDraw.Draw(m1).polygon(pts, fill=int(255 * q))
            if only_added:   # المساحة المضافة بس = شكل البعد ناقص السنة الأصلية
                m2 = Image.new("L", im.size); ImageDraw.Draw(m2).polygon([B.tf(x, y, z) for x, y in Bt[k]["c"][::2]], fill=255)
                m1 = Image.fromarray(np.clip(np.array(m1).astype(int) - np.array(m2), 0, 255).astype(np.uint8))
            col_l = Image.new("RGBA", im.size, fill); col_l.putalpha(Image.fromarray((np.array(m1) * (fill[3] / 255)).astype(np.uint8))); lay = Image.alpha_composite(lay, col_l); d = ImageDraw.Draw(lay)
        part = anim.partial(pts, q)
        if dashed:
            for j in range(0, len(part) - 1, 2): d.line([part[j], part[j + 1]], fill=col + (255,), width=width)
        else: d.line(part, fill=col + (255,), width=width)
    return Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")
def sweep(a, b, p, vertical=False, glow=True):   # مسح بخط مضيء بين صورتين
    W, H = a.size; m = Image.new("L", a.size, 0); d = ImageDraw.Draw(m); x = (H if vertical else W) * ease(p)
    d.rectangle((0, 0, W, x) if vertical else (0, 0, x, H), fill=255); out = Image.composite(b, a, m)
    if glow and 0 < p < 1:
        g = Image.new("RGBA", a.size); gd = ImageDraw.Draw(g)
        if vertical: gd.rectangle((0, x - 4, W, x + 4), fill=(255, 255, 255, 230))
        else: gd.rectangle((x - 4, 0, x + 4, H), fill=(255, 255, 255, 230))
        out = Image.alpha_composite(out.convert("RGBA"), Image.alpha_composite(g.filter(ImageFilter.GaussianBlur(10)), g)).convert("RGB")
    return out
class Clip:   # فيديو يتقري بالترتيب (عناصر مولّدة)
    def __init__(s, p, W=FW, H=FH, loop=True):
        s.p, s.W, s.H, s.loop, s.fr = p, W, H, loop, []
        raw = subprocess.run(["ffmpeg", "-v", "quiet", "-i", p, "-vf", f"fps={FPS},scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
        n = len(raw) // (W * H * 3); s.fr = [raw[i * W * H * 3:(i + 1) * W * H * 3] for i in range(n)]
    def at(s, t):
        i = int(t * FPS); i = i % len(s.fr) if s.loop else min(i, len(s.fr) - 1)
        return Image.frombytes("RGB", (s.W, s.H), s.fr[i])
def key_black(im, thr=18):   # عنصر على خلفية سودا → شفاف
    a = np.array(im.convert("RGB")).astype(np.float32); al = np.clip((a.max(2) - thr) * 6, 0, 255).astype(np.uint8)
    out = im.convert("RGBA"); out.putalpha(Image.fromarray(al)); return out
def paste(im, el, cx, cy, scale=1.0, ang=0.0, alpha=1.0):   # عنصر شفاف فوق الفريم
    if scale <= 0.01 or alpha <= 0: return im
    e = el.resize((max(1, int(el.width * scale)), max(1, int(el.height * scale))), Image.BICUBIC)
    if ang: e = e.rotate(ang, resample=Image.BICUBIC, expand=True)
    if alpha < 1: a = e.split()[3].point(lambda v: int(v * alpha)); e.putalpha(a)
    base = im.convert("RGBA"); base.alpha_composite(e, (int(cx - e.width / 2), int(cy - e.height / 2))) if (0 <= int(cx - e.width / 2) and 0 <= int(cy - e.height / 2)) else base.paste(e, (int(cx - e.width / 2), int(cy - e.height / 2)), e)
    return base.convert("RGB")
class Particles:   # رذاذ / تفتت: نقط من منطقة تطير
    def __init__(s, src, box, n=900, speed=600, seed=1, col=None, grav=500, spread=1.0, dirx=0.0, diry=0.0):
        r = np.random.default_rng(seed); x0, y0, x1, y1 = box; s.p = np.c_[r.uniform(x0, x1, n), r.uniform(y0, y1, n)]
        a = r.uniform(0, 2 * np.pi, n); v = r.uniform(.2, 1, n) * speed; s.v = np.c_[np.cos(a) * v * spread + dirx * speed, np.sin(a) * v * spread + diry * speed]
        s.sz = r.uniform(3, 11, n); s.g = grav; arr = np.array(src) if src is not None else None
        s.c = [tuple(int(v) for v in arr[int(min(max(y, 0), arr.shape[0] - 1)), int(min(max(x, 0), arr.shape[1] - 1))]) if arr is not None else (col or (255, 255, 255)) for x, y in s.p]
    def draw(s, im, t, life=1.4):
        if t <= 0: return im
        lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay); al = max(0, 1 - t / life)
        P = s.p + s.v * t; P[:, 1] += .5 * s.g * t * t
        for (x, y), z, c in zip(P, s.sz, s.c): d.rectangle((x, y, x + z, y + z), fill=c + (int(255 * al),))
        return Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")
_FL = {}
def face_pts(im):   # نقاط الوجه (mediapipe) على صورة بمقاس الفريم
    import mediapipe as mp
    from mediapipe.tasks.python import vision, BaseOptions
    key = id(im)
    if key not in _FL:
        det = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(base_options=BaseOptions(model_asset_path=S + "face/face_landmarker.task"), num_faces=1))
        a = np.ascontiguousarray(np.array(im.convert("RGB"))); Lm = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=a)).face_landmarks[0]
        _FL[key] = np.float32([[p.x * im.width, p.y * im.height] for p in Lm])
    return _FL[key]
def teeth_pieces(sh_name="A"):   # قطع السنان العلوية الحقيقية من صورة البعد (RGBA) + مكانها
    sh = shot(sh_name); src = L(C + "after/front.jpg") if sh_name == "A" else BM; out = []
    for t in sorted([t for t in sh.teeth_all if t["fdi"] < 30], key=lambda t: t["cx"]):
        m = Image.new("L", src.size); ImageDraw.Draw(m).polygon([tuple(p) for p in t["c"]], fill=255); box = (t["x"], t["y"], t["x"] + t["w"], t["y"] + t["h"])
        pc = src.crop(box).convert("RGBA"); pc.putalpha(m.crop(box)); out.append((t["fdi"], pc, t["cx"], t["y"] + t["h"] / 2))
    return out
def neon_write(im, s, p, y, col=(80, 220, 255), size=110):   # كتابة بضوء نيون
    lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay); f = F(FA, size)
    d.text((im.width / 2, y), s, font=f, fill=col + (255,), anchor="mm", direction="rtl"); tw = d.textlength(s, font=f, direction="rtl")
    m = Image.new("L", im.size); ImageDraw.Draw(m).rectangle((im.width / 2 + tw / 2 - tw * ease(p), 0, im.width, im.height), fill=255)
    lay.putalpha(Image.fromarray(np.minimum(np.array(lay.split()[3]), np.array(m)))); g = lay.filter(ImageFilter.GaussianBlur(14))
    return Image.alpha_composite(Image.alpha_composite(im.convert("RGBA"), g), lay).convert("RGB")
# ---------- المحرك ----------
def beats(music, moff, dur):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(moff), "-t", str(dur), "-i", music, "-ac", "1", "-ar", "11025", "-f", "s16le", "-"], capture_output=True).stdout
    a = np.frombuffer(raw, np.int16).astype(np.float32) / 32768; hp = 256; e = np.array([np.sum(a[i:i + hp] ** 2) for i in range(0, len(a) - hp, hp)])
    o = np.maximum(0, np.diff(np.log(e + 1e-6))); bt = []
    for i in sorted(range(len(o)), key=lambda i: -o[i]):
        t = i * hp / 11025
        if o[i] < .5: break
        if all(abs(t - b) > .25 for b in bt): bt.append(t)
    return sorted(bt)
MUS = {"piano": (S + "gen/music.mp3", 20.0), "beat": (S + "reel/beat.mp3", 9.6), "chip": (S + "tpl/g/chip.wav", 0.0)}
_GT = {}
def gum_texture(H):
    """نسيج لثة طبيعي (شريط بطول الكادر) من الجزء اليمين في خلفية اللثة المعتمدة — مفيهوش سنان. بيتعمل مرة لكل حالة."""
    if H in _GT: return _GT[H]
    cands = [p for p in ((CASE_DIR + "/elements/gum_back_after.png") if CASE_DIR else "", S + "assets/gum_back_after_dx93.png", S + "assets/gum_back_after.png") if p and os.path.exists(p)]
    if not cands: _GT[H] = None; return None
    b = np.asarray(Image.open(cands[0]).convert("RGB").resize((FW, H))).astype(np.float32)[:, int(FW * .89):].copy()
    ok = np.where(b.max(2).mean(1) > 60)[0]
    if len(ok): b[:ok[0]] = b[ok[0]]; b[ok[-1] + 1:] = b[ok[-1]]
    _GT[H] = b; return b
def auto_gum(im, dark=28, tol=3, rim=9, feather=3):
    """أداة عامة على مستوى الريندر (البلاي بوك E20/R4.1): أي كادر فيه فك معزول على إسود واللثة مش واصلة لحافة الشاشة اليمين
    ← الفراغ اللي بعد قوس اللثة بيتملي بنسيج لثة طبيعي بلون اللثة اللي جنبه. السنان واللثة الحقيقية مابيتلمسوش،
    والصفوف اللي مافيهاش فك بتفضل إسود. الكادرات اللي مش فك معزول بترجع زي ما هي."""
    a = np.asarray(im.convert("RGB")); H, W = a.shape[:2]; g = a.max(2) > dark
    if g[:, :int(W * .25)].mean() > .12: return im
    hsv = cv2.cvtColor(a, cv2.COLOR_RGB2HSV); pink = (hsv[..., 0] > 150) & (hsv[..., 1] > 40) & (hsv[..., 2] > 90)   # لون اللثة (وردي/أحمر) — الكاست البيج بيبقى hue≈11 فمابيتحسبش
    if pink.mean() < .03 or pink.sum() < .12 * g.sum(): return im       # مش لثة (مثلًا كاست بيج)
    if np.where(pink)[1].mean() < W * .5: return im                    # اللثة مش ناحية اليمين
    gs = cv2.morphologyEx(g.astype(np.uint8), cv2.MORPH_OPEN, np.ones((9, 9), np.uint8)) > 0   # الخطوط الرفيعة في أي اتجاه (مسطرة، عقرب الساعة، قوس) مابتتحسبش محتوى — كانت بتقطع ملء اللثة وتسيب إسود على شكلها (a03 9.3 و15.1)
    has = gs.sum(1) > W * .05; xr = W - 1 - np.argmax(gs[:, ::-1], axis=1); gap = (W - 1) - xr
    rows = has & (gap > tol) & (gap < W * .35)
    hr = np.where(has)[0]
    band = len(hr) > 0 and (0 < hr[0] < H * .07 or 0 < H - 1 - hr[-1] < H * .07)
    if rows.sum() < 3 and not band: return im   # مفيش فراغ يمين ولا شريط فوق/تحت (اللثة واصلة للحافة اليمين بس الشريط اللي فوق لسه محتاج يتملي — كان بيرجع هنا بدري)
    T = gum_texture(H)
    if T is None: return im
    x0 = np.clip(xr - rim, 0, W - 1).astype(np.float32); Ht, Wt = T.shape[:2]
    xs = np.arange(W, dtype=np.float32)[None, :]; mx = (xs - x0[:, None]) / np.maximum(1, W - x0[:, None]) * (Wt - 1)
    my = np.repeat((np.arange(H, dtype=np.float32) * (Ht - 1) / max(1, H - 1))[:, None], W, 1)
    fill = cv2.remap(T, np.clip(mx, 0, Wt - 1).astype(np.float32), my, cv2.INTER_LINEAR)
    # لون اللثة اللي جنب الفراغ في نفس الصف (نعمه رأسيًا علشان مايبقاش فيه شرايط)
    af = a.astype(np.float32); sh = np.zeros((H, 3), np.float32); w = np.zeros(H, np.float32)
    for y in np.where(rows)[0]:
        l0, l1 = max(0, int(xr[y]) - 16), max(1, int(xr[y]) - 4); seg = af[y, l0:l1]; pk = pink[y, l0:l1]
        if pk.sum() >= 3: sh[y] = seg[pk].mean(0) - T[min(Ht - 1, int(y * (Ht - 1) / max(1, H - 1))), :6].mean(0); w[y] = 1
    if w.sum():
        ks = (0, 0); sm = cv2.GaussianBlur(sh * w[:, None], (1, 0), sigmaX=1, sigmaY=18); ws = cv2.GaussianBlur(w[:, None], (1, 0), sigmaX=1, sigmaY=18)
        sh = sm / np.maximum(ws, 1e-3)
    fill = fill + sh[:, None, :]
    m = ((xs >= x0[:, None]) & rows[:, None]).astype(np.float32)
    m = cv2.GaussianBlur(m, (0, 0), feather)[..., None]
    out = af * (1 - m) + fill * m
    # شريط رفيع **فوق** الفك (< 7% من الطول) بيبان زي حافة إسود بعد ما اللثة وصلت للحافة اليمين (E84)
    # ← اللثة بس (من بعد آخر سنة) بتكمل لفوق بانعكاس اللثة اللي تحت الشريط مباشرة — بعد ملء فراغ اليمين. السنان مابتتعكسش، واللي تحت الفك مابيتلمسش.
    hr = np.where(has)[0]
    if len(hr) and 0 < hr[0] < H * .07:
        ry = None
        for dy in range(3, 90, 3):
            yy = min(H - 1, hr[0] + dy)
            if pink[yy].sum() >= 5: ry = yy; break
        if ry is not None:
            band = slice(ry, min(H, ry + 40)); hsv_b = hsv[band]
            teeth = (hsv_b[..., 2] > 150) & (hsv_b[..., 1] < 70)
            tx = np.where(teeth.any(0))[0]
            x0 = max(int(np.percentile(np.where(pink[ry])[0], 5)), (int(tx.max()) + 6) if len(tx) else 0)
            if x0 < W - 10:
                for y in range(0, ry):
                    out[y, x0:] = out[min(H - 1, 2 * ry - y), x0:]
                # حافة ناعمة عند x0 (مش خط حاد)
                k = min(12, W - x0); ramp = np.linspace(0, 1, k)[None, :, None]
                out[:ry, x0:x0 + k] = af[:ry, x0:x0 + k] * (1 - ramp) + out[:ry, x0:x0 + k] * ramp
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
AUTO_GUM = os.environ.get("AUTO_GUM", "1") != "0"
def render(name, scenes, music="piano", W=FW, H=FH, xfade=0.0, still=False):
    """scenes: [(المدة, دالة(t_محلي) → صورة)]"""
    starts = np.cumsum([0] + [d for d, _ in scenes]); DUR = float(starts[-1])
    def frame(t):
        i = max(0, min(len(scenes) - 1, int(np.searchsorted(starts, t, "right") - 1))); lt = t - starts[i]; im = scenes[i][1](lt)
        if xfade and i + 1 < len(scenes) and lt > scenes[i][0] - xfade: im = blend(im, scenes[i + 1][1](0), (lt - (scenes[i][0] - xfade)) / xfade)
        im = im.resize((W, H)) if im.size != (W, H) else im
        return auto_gum(im) if (AUTO_GUM and not im.info.get("no_auto_gum")) else im   # مشهد بيملا اللثة بنفسه قبل الحركة (زي خروج الفك من الكادر) بيقفل الملء التلقائي   # البلاي بوك R4.1: مفيش فراغ إسود يمين الفك المعزول في أي قالب
    if still:
        ts = np.linspace(.2, DUR - .1, 12); ims = [frame(t).resize((W // 5, H // 5)) for t in ts]
        sh = Image.new("RGB", (W // 5 * 6, H // 5 * 2))
        for k, im in enumerate(ims): sh.paste(im, ((k % 6) * (W // 5), (k // 6) * (H // 5)))
        sh.save(OUTD + name + "_still.jpg"); return OUTD + name + "_still.jpg"
    mp, mo = MUS[music]; out = OUTD + name + ".mp4"
    cmd = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-ss", str(mo), "-i", mp,
           "-filter_complex", f"[1:a]atrim=0:{DUR},asetpts=PTS-STARTPTS,afade=t=in:d=0.3,afade=t=out:st={DUR - 1.2}:d=1.2,loudnorm=I=-14:TP=-1.5[a]", "-map", "0:v", "-map", "[a]",
           "-c:a", "aac", "-b:a", "192k", "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-t", str(DUR), out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(int(DUR * FPS)): p.stdin.write(frame(i / FPS).convert("RGB").tobytes())
    p.stdin.close(); p.wait(); return out
def dur(p): return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p], capture_output=True, text=True).stdout or 0)
def compare(name, ref):
    out = OUTD + "cmp_" + name + ".mp4"; rp = S + f"up/{ref}/in/v.mp4"
    if not os.path.exists(rp) or not os.path.exists(S + "sbs.sh"):   # على المنصة مفيش الفيديوهات الأصلية: الناتج هو فيديونا بس
        print(f"DURATION ours={dur(OUTD + name + '.mp4'):.1f}s ref=- OK", flush=True); return OUTD + name + ".mp4"
    subprocess.run(["bash", S + "sbs.sh", rp, OUTD + name + ".mp4", out])
    a, b = dur(OUTD + name + ".mp4"), dur(rp)   # قاعدة: مدتنا = مدة الأصل
    print(f"DURATION ours={a:.1f}s ref={b:.1f}s", "OK" if a >= b - .5 else "SHORT: في مشهد ناقص"); return out


_QW = set()
def qa_warn(code, msg):
    """تحذير وقت الريندر (البلاي بوك Q12): بيتكتب في لوج الريندر، وفلتر الفيديو (qa_video) بيقراه ويسقّط القالب."""
    if (code, msg) in _QW: return
    _QW.add((code, msg)); print(f"QA_WARN {code} {msg}", flush=True)
