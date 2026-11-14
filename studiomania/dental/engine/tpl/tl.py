"""مكتبة القوالب: أصول الحالة الحقيقية + أدوات الرسم والمورف والتحليل + محرك الإخراج + المقارنة بالأصل.
كل قالب = قائمة مشاهد (المدة، دالة ترجع فريم)."""
import sys, os, json, subprocess, numpy as np, cv2, math
S = ((__import__("os").environ.get("DENTAL_ROOT") or __import__("os").path.dirname(__import__("os").path.dirname(__import__("os").path.abspath(__file__)))) + "/")
sys.path.insert(0, S + "ana"); os.chdir(S + "ana")
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps, ImageEnhance
import anim
from anim import Shot, ease, FW, FH, FPS, FD
CASE_DIR = os.environ.get("CASE_DIR")   # فولدر الحالة (product/): canon/ = الصور بأسماء ثابتة، ana/ = تحليل السنان، elements/ = العناصر المعتمدة
C = (CASE_DIR + "/canon/") if CASE_DIR else S + "case1/"; AN = (CASE_DIR + "/ana/") if CASE_DIR else ""   # AN فاضي = ملفات التحليل في ana/ زي ما هي
G = S + "tpl/g/"; OUTD = (CASE_DIR + "/out/") if CASE_DIR else S + "tpl/out/"; os.makedirs(OUTD, exist_ok=True)
# بيانات العيادة: من الحالة (case.json → "clinic": {"doctor", "name", "logo"}) أو متغيرات DOC_NAME/CLINIC_NAME/CLINIC_LOGO.
# مفيش اسم دكتور ولا شعار من الفيديوهات الأصلية في القوالب أبدًا؛ القيم دي للتجربة بس لحد ما العيادة ترفع بياناتها.
_CJ = {}
try: _CJ = (json.load(open(CASE_DIR + "/case.json")).get("clinic") or {}) if CASE_DIR else {}
except Exception: _CJ = {}
DOC = os.environ.get("DOC_NAME") or _CJ.get("doctor") or "د. إسلام جمعة"; CLINIC = os.environ.get("CLINIC_NAME") or _CJ.get("name") or "عيادة د. إسلام جمعة"
CLINIC_LOGO = os.environ.get("CLINIC_LOGO") or ((CASE_DIR + "/" + _CJ["logo"]) if CASE_DIR and _CJ.get("logo") else ""); GOLD = (214, 178, 106)
F = lambda n, s: ImageFont.truetype(FD + n, s)
FA, FA5, FRQ, FSER = "TY-Alexandria-800.ttf", "TY-Alexandria-500.ttf", "TY-ArefRuqaa-700.ttf", "TY-InstrumentSerif-Italic.ttf"
L = lambda p: Image.open(p).convert("RGB")
# ---------- أصول الحالة ----------
# 🙈 حالة من غير صورة وجه (المريض مابيتصورش): القوالب اللي مافيهاش وجه (NO_FACE) بتشتغل عادي، والباقي مابيتعرضش للحالة دي
NO_FACE_CASE = not os.path.exists(C + "before/face.webp")
BF = Image.new("RGB", (1080, 1350)) if NO_FACE_CASE else L(C + "before/face.webp"); BM = L(C + "before/macro.jpg")
# الصور الاختيارية (أقرب/جانبية): لو الطبيب مارفعهاش نستخدم الأمامية الحقيقية بدلها (الحالة ماتقعش بسبب صورة مش موجودة)
Lo = lambda p, alt: L(p if os.path.exists(p) else alt)
AF = L(C + "after/front.jpg"); AC = Lo(C + "after/front_close.jpg", C + "after/front.jpg")
AS1 = Lo(C + "after/side1.jpg", C + "after/front.jpg"); AS2 = Lo(C + "after/side2.jpg", C + "after/side1.jpg" if os.path.exists(C + "after/side1.jpg") else C + "after/front.jpg")
SF = Lo(C + "ret/smile_front_ret4.jpg", C + "after/front.jpg")   # حالة من غير صورة ابتسامة (قوالب الريتراكتور بس): بديل عشان التحميل مايقعش
SR, SL = [Lo(C + f"ret/{n}_ret4.jpg", C + "ret/smile_front_ret4.jpg" if os.path.exists(C + "ret/smile_front_ret4.jpg") else C + "after/front.jpg") for n in ("smile_side_r", "smile_side_l")]
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
def blend(a, b, p):
    """مزج مشهدين. أي طرف فيه فك معزول بتتملا لثته **قبل** المزج: الملء التلقائي وقت الريندر بيتخطى الكادر المخلوط
    (الشمال مش إسود)، فكان الفراغ الإسود يمين اللثة بيبان طول الذوبان (E437: a03 0–6.6 وa09 7.0)."""
    p = max(0, min(1, p))
    if p <= 0: return a
    if p >= 1: return b
    if AUTO_GUM: a, b = auto_gum(a), auto_gum(b)
    return Image.blend(a, b.resize(a.size) if b.size != a.size else b, p)
def black(W=FW, H=FH): return Image.new("RGB", (W, H), (0, 0, 0))
def flash(im, p, col=(255, 255, 255)): return Image.blend(im, Image.new("RGB", im.size, col), max(0, min(1, p)))
def txt(im, xy, s, size=56, font=FA, fill=(255, 255, 255), anchor="mm", stroke=3, alpha=1.0, rtl=True):
    lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay)
    d.text(xy, s, font=F(font, size), fill=fill + (int(255 * alpha),), anchor=anchor, direction="rtl" if rtl else None, stroke_width=stroke, stroke_fill=(0, 0, 0, int(170 * alpha)))
    if alpha > .3:   # كلام خارج برا الشاشة (اتقص) = عيب: بيتسجل وفلتر الفيديو بيقراه
        bb = d.textbbox(xy, s, font=F(font, size), anchor=anchor, direction="rtl" if rtl else None, stroke_width=stroke)
        if bb[0] < 4 or bb[1] < 4 or bb[2] > im.width - 4 or bb[3] > im.height - 4: qa_warn("TEXT_CLIPPED", f"«{s}» خارج الشاشة {tuple(int(v) for v in bb)}")
    return Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")
def chip(im, s, y=150, alpha=1.0, x=None):
    """كلمة على كارت (قبل/بعد/النتيجة). x=None: لو في مساحة سودا شمال السنان (الفك المعزول) الكلمة بتقعد في نصها،
    وإلا في نص الكادر. الكارت عمره ما يقعد فوق اللثة/السنان ولا يتقص عند الحافة (E443: a11 18–24)."""
    lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay); f = F(FA, 46); w = d.textlength(s, font=f, direction="rtl") + 80
    cx = im.width / 2 if x is None else x
    if x is None:
        g = np.asarray(im.convert("L")); cols = np.where((g > 24).sum(0) > g.shape[0] * .02)[0]; xb = int(cols.min()) if len(cols) else im.width
        if xb >= w + 40: cx = xb / 2   # المساحة السودا تكفي الكارت بهامش
    d.rounded_rectangle((cx - w / 2, y - 42, cx + w / 2, y + 42), 42, fill=(0, 0, 0, int(140 * alpha)))
    d.text((cx, y), s, font=f, fill=(255, 255, 255, int(255 * alpha)), anchor="mm", direction="rtl")
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
    """اللثة بتتملا على الكادر الثابت **قبل** الزووم، والكادر بيتعلّم no_auto_gum: الملء بعد الزووم بيتحسب على بكسلات
    متحركة كل كادر، فالفراغات الغامقة بين السنان كانت بترمش (E438: a17 12.9)."""
    def g(t):
        im = fn(t); im = auto_gum(im) if (AUTO_GUM and not im.info.get("no_auto_gum")) else im
        out = zoomc(im, 1 + k * ease(min(1, t / dur)) * .4 + k * .6 * min(1, t / dur), cx, cy); out.info["no_auto_gum"] = True; return out
    return g
def mouth_mid(lm):
    """نص فتحة البق (بين الشفة العليا والسفلى من جوه) — ده المركز الصح لأي لقطة ابتسامة قريبة.
    lm[13] لوحده (الشفة العليا) بيزق الابتسامة ناحية واحدة من الشاشة (E441: a17 27.7)."""
    return (np.asarray(lm[13], float) + np.asarray(lm[14], float)) / 2
def logo(v, W=FW, H=FH):   # شعار العيادة (مؤقت لحد ما الطبيب يرفع شعاره) + لمعة
    im = Image.new("RGB", (W, H), (6, 6, 7)); d = ImageDraw.Draw(im); p = ease(v / .6); col = tuple(int(c * p) for c in GOLD); cy = H / 2
    if CLINIC_LOGO and os.path.exists(CLINIC_LOGO):   # شعار العيادة الحقيقي (بألوانه — مابنغيّرش ألوانه من غير موافقة العميل)
        lg = Image.open(CLINIC_LOGO).convert("RGBA"); sc_ = min(300 / lg.width, 220 / lg.height); lg = lg.resize((max(1, int(lg.width * sc_)), max(1, int(lg.height * sc_))), Image.LANCZOS)
        a_ = lg.split()[3].point(lambda x: int(x * p)); im.paste(lg, (int(W / 2 - lg.width / 2), int(cy - 140 - lg.height / 2)), a_)
    else: d.ellipse((W / 2 - 90, cy - 230, W / 2 + 90, cy - 50), outline=col, width=5); tooth_icon(d, W / 2, cy - 140, 60, col, 5)
    d.text((W / 2, cy + 40), CLINIC, font=F(FA, 66 if W > 900 else 50), fill=col, anchor="mm", direction="rtl")
    d.text((W / 2, cy + 125), DOC, font=F(FA5, 42), fill=tuple(int(200 * p) for _ in range(3)), anchor="mm", direction="rtl")
    gx = -300 + (W + 600) * min(1, max(0, (v - .7) / 1.0)); sh = Image.new("L", (W, H))
    ImageDraw.Draw(sh).polygon([(gx, cy - 260), (gx + 90, cy - 260), (gx - 110, cy + 180), (gx - 200, cy + 180)], fill=150)
    m = Image.fromarray(np.minimum(np.array(sh), (np.array(im.convert("L")) > 40) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))
    return zoomc(Image.composite(Image.new("RGB", (W, H), (255, 240, 200)), im, m), 1 + .05 * v / 3.5)   # الشعار بيقرّب ببطء طول المشهد (كان بيقف بعد 3.5ث ← لقطة متجمدة في كروت النهاية: a31 28.8)
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
        # سنة في طرف القوس مش باينة كويس في صورة البعد (الضاحك مغطى بالشفة/ظل/برا الفوكس): جواها في صورة البعد ظل وشفة مش سنة،
        # فلو دخلت المورف بيطلع شريط بني جنب الناب. بنسيبها على حالها من صورة القبل (زي أي سنة مش موجودة في البعد)
        lab_ = cv2.cvtColor(np.clip(_M["FA_"], 0, 255).astype(np.uint8), cv2.COLOR_RGB2LAB)
        def _vis(k):
            mm = np.zeros(lab_.shape[:2], np.uint8); cv2.fillPoly(mm, [_M["planned"][k].astype(np.int32)], 255); mm = cv2.erode(mm, np.ones((7, 7), np.uint8)) > 0
            if mm.sum() < 50: return 0.0
            return float(((lab_[..., 0][mm] > 120) & (lab_[..., 1][mm] < 140)).mean())
        ups = sorted([k for k in common if k < 30], key=lambda k: _M["planned"][k][:, 0].mean()); drop = []
        for end in (ups, ups[::-1]):
            for k in end:
                if _vis(k) < .75: drop.append(k)   # كان 0.9: سنة طرفية في ضل زاوية البق (test1 15: 0.86، لونها سنة واضح) كانت بتتساب قديمة بنية جنب الفينير
                else: break
        # سنة متغطية في الصورة اللي بتتاخد منها (الشفة السفلية مغطية حد السنان السفلية في صورة البعد بالمبعد): لو دخلت المورف بتطلع مبتورة
        # في مشهد السنان فيه باينة كاملة (srv: 31/32/41/42 طولهم في البعد 59-73% من القبل). الفينير مابيقصّرش السنة بالشكل ده،
        # فأي سنة طولها في البعد أقل من 85% من طولها في القبل = حدودها مش باينة ← مابتتاخدش (بتفضل من القبل). ولو أغلب فك متغطي ← الصورة ماتنفعش للفك ده
        Bt0 = {t["fdi"]: t for t in shot("B").teeth_all}; cov = []
        for k in common:
            if k in Bt0 and k not in drop:
                hb = float(np.ptp(Bt0[k]["c"][:, 1])); ha = float(np.ptp(_M["planned"][k][:, 1]))
                if hb > 0 and ha / hb < .85: cov.append(k)
        if cov and not os.environ.get("ISO_NOCOVER"):
            drop += [k for k in cov if k not in drop]; _M["covered"] = cov
            iss = {}
            for jaw, ks in (("upper", [k for k in common if k < 30]), ("lower", [k for k in common if k > 30])):
                cj = [k for k in cov if (k < 30) == (jaw == "upper")]
                if ks and len(cj) >= max(2, len(ks) * .4): iss[jaw] = {"covered": cj, "msg": "صورة الريتراكتور بعد العلاج: حدود الأسنان " + ("العلوية" if jaw == "upper" else "السفلية") + " غير ظاهرة (تغطيها الشفة)، نحتاج صورة تظهر فيها الأسنان كاملة"}
            print("morph: teeth covered in the after photo (edges not visible):", cov, "| unusable jaw:", list(iss), flush=True)
            if iss and CASE_DIR:
                __import__("json").dump({"covered": cov, "unusable": iss}, open(CASE_DIR + "/qa/source_issues.json", "w"), ensure_ascii=False, indent=1)
            if iss and not os.environ.get("ALLOW_PARTIAL"):
                # فك كامل سنانه متغطية في صورة البعد: مافيش نتيجة صح ممكن تطلع من **التحول** (لا مبتورة ولا نص قديم ونص جديد) ← المشهد اللي بيرسم التحول بيوقف الريندر
                # والطبيب بيتطلب منه صورة السنان فيها باينة كاملة (srv: كانت بتطلع فوق أبيض وتحت أصفر).
                # القوالب اللي بتاخد من الإعداد ده الأسنان العلوية المشتركة بس (فينيرات a12) بتكمّل عادي (البنت: صورة البعد من الجنب)
                _M["unusable_msg"] = "PHOTO_UNUSABLE " + " | ".join(v["msg"] for v in iss.values())
            if CASE_DIR:
                os.makedirs(CASE_DIR + "/qa", exist_ok=True); __import__("json").dump({"covered": cov, "unusable": iss}, open(CASE_DIR + "/qa/source_issues.json", "w"), ensure_ascii=False, indent=1)
        # سنة علوية موجودة في القبل ومالهاش مقابل في البعد خالص (الموديل مالقاهاش في صورة البعد): كانت بتبهت لشبح في نص المورف
        # وتختفي في الآخر (srv: السنة 24). نفس القاعدة: بتفضل زي ما هي من القبل — عمرنا ما بنشيل سنة
        Bk = [t["fdi"] for t in shot("B").teeth_all if t["fdi"] < 30]
        drop += [k for k in Bk if k not in common and k not in drop]
        if os.environ.get("ISO_NOHIDDEN"): drop = []   # للمعايرة بس: يرجّع السلوك القديم
        _M["hidden"] = drop   # سنان طرفية مغطاة بالشفة/ظل في صورة البعد: شكلها «بعد» مش موجود فعلًا، فبتفضل زي ما هي من صورة القبل
        if drop:   # (مش بتتشال: بتفضل ظاهرة في العزل بحدودها من القبل، بس ما بتدخلش المورف — جرّبنا ناخد شكلها من البعد فطلعت شريحة طايرة وفراغ إسود)
            print("morph: end teeth hidden in after photo, kept from before:", drop); common = [k for k in common if k not in drop]; _M["common"] = common
            _M["planned"] = {k: v for k, v in _M["planned"].items() if k in common}
        B = shot("B"); Bt = {t["fdi"]: t for t in B.teeth_all}
        up_ = [k for k in common if k < 30]; M_up = up_
        tm = np.zeros(ib.shape[:2], np.uint8)   # السنان (قبل + بعد) محمية تماماً: التنضيف على اللثة والشفايف بس
        for t_ in B.teeth_all: cv2.fillPoly(tm, [t_["c"].astype(np.int32)], 255)
        for k in common: cv2.fillPoly(tm, [_M["planned"][k].astype(np.int32)], 255)
        tm = cv2.dilate(tm, np.ones((15, 15), np.uint8))
        for kk in ("FB", "FA_"): _M[kk] = dehair(_M[kk], tm)
        _M["RB"], _M["RA"] = r(_M["FB"]), r(_M["FA_"])
        own = []
        for k in up_ + [k for k in _M["hidden"] if k < 30 and k in Bt]:   # حدود سنان القبل نفسها بس (مش المدموجة مع البعد) عشان مايدخلش أطراف السنان السفلية
            mm = np.zeros(ib.shape[:2], np.uint8); cv2.fillPoly(mm, [Bt[k]["c"].astype(np.int32)], 255); own.append(mm)
        isoB = anim.iso_mask(ib, own, src=C + "before/macro.jpg"); allm = np.zeros_like(isoB)
        for k in up_: allm = np.maximum(allm, masks[k])
        top_lower = min(t["y"] for t in B.teeth_all if t["fdi"] > 30)
        allm[top_lower + 25:] = 0 if False else allm[top_lower + 25:]
        B.iso = Image.fromarray(r(isoB)); _M["isoB"] = isoB; _M["shape"] = ib.shape[:2]
        At_ = {t["fdi"] for t in shot("A").teeth_all}
        span_keys = up_ + [k for k in _M["hidden"] if k < 30 and k in Bt and k in At_]   # الكادر يلم السنان اللي في الصورتين بس:
        # سنة مالهاش وجود في صورة البعد خالص (test1 26) مابتوسّعش الكادر ← بتفضل على الطرف أو برّاه زي أي سنة ورا (مش بنشيلها)
        xs = [Bt[k]["x"] for k in span_keys] + [Bt[k]["x"] + Bt[k]["w"] for k in span_keys]; span = (max(xs) - min(xs)) * 1.12
        B.ch = span; B.cw = span * FW / FH; B.cY = (max(xs) + min(xs)) / 2; _M["order"] = sorted(up_, key=lambda k: Bt[k]["cx"]); _M["lower"] = [k for k in common if k > 30]
    return _M
_SM = {}
def _need_full():   # التحول نفسه (الفكين قبل ← بعد) محتاج صورة بعد الأسنان فيها كاملة
    M = morph_setup()
    if M.get("unusable_msg"): raise SystemExit(M["unusable_msg"])
def shape_morph():
    _need_full()
    if "sm" not in _SM:
        from morph import ShapeMorph
        M = morph_setup(); Bt = {t["fdi"]: t for t in shot("B").teeth_all}
        _SM["sm"] = ShapeMorph(M["FB"], M["FA_"], {k: Bt[k]["c"] for k in M["common"]}, {k: M["planned"][k] for k in M["common"]},
                               keep=[Bt[k]["c"] for k in M.get("hidden", []) if k in Bt])   # السنان الباقية من القبل
    return _SM["sm"]
def current_contours(prog):   # حدود السنان زي ما هي ظاهرة دلوقتي (عشان الخطوط تبقى على السنان نفسها)
    _need_full()
    sm = shape_morph(); out = {}
    for k in sm.keys:
        p = prog if isinstance(prog, (int, float)) else prog.get(k, 0); out[k] = sm.contour(k, max(0, min(1, p)))
    return out
def morph_img(prog, rotated=True, flash_t=None):
    _need_full()
    """المورف الحقيقي: شكل كل سنة بيتحول في مكانها (مش مزج)."""
    f = shape_morph().frame(prog); im = Image.fromarray(np.clip(f, 0, 255).astype(np.uint8))
    return rot(im) if rotated else im
_HI = {}
def hi_detail():
    """التكبير الأمين في الفيديو: تفاصيل الحدة (الفرق بين النسخة عالية الدقة والصورة الأصلية مكبّرة) لصورتي القبل والبعد، متقسمة:
    لثة وخلفية (من القبل، في كل لحظات التحول)، سنان القبل (قبل التحول بس)، سنان البعد المتطابقة على القبل (بعد التحول بس).
    أثناء التحول نفسه السنان مابتاخدش تفاصيل (شكلها بيتغير). من غير ملفات *_hi.png بيرجّع None والفيديو يطلع بالدقة العادية."""
    if "ok" in _HI: return _HI if _HI["ok"] else None
    _HI["ok"] = False
    pb, pa = C + "before/macro_hi.png", C + "after/front_hi.png"
    if os.environ.get("NO_HIRES") or not (os.path.exists(pb) and os.path.exists(pa)): return None
    try:
        M = morph_setup(); B = shot("B"); H, W = M["shape"]
        hb = np.asarray(L(pb), np.float32); k = int(round(hb.shape[1] / W))
        if k < 2 or hb.shape[1] != W * k or hb.shape[0] != H * k: return None
        DB = hb - np.asarray(L(C + "before/macro.jpg").resize((W * k, H * k), Image.BICUBIC), np.float32); del hb
        la = L(C + "after/front.jpg"); ha = L(pa)
        if ha.size != (la.width * k, la.height * k): return None
        DA = np.asarray(ha, np.float32) - np.asarray(la.resize(ha.size, Image.BICUBIC), np.float32)
        m2 = np.asarray(M["M"], np.float32).copy(); m2[:, 2] *= k
        DA = cv2.warpAffine(DA, m2, (W * k, H * k), flags=cv2.INTER_LINEAR)
        def poly(cs):
            mk = np.zeros((H * k, W * k), np.uint8)
            for c in cs: cv2.fillPoly(mk, [(np.asarray(c, np.float32) * k).astype(np.int32)], 255)
            return mk
        Bt = {t["fdi"]: t for t in B.teeth_all}; hid = [Bt[q]["c"] for q in M.get("hidden", []) if q in Bt]
        mb = poly([t["c"] for t in B.teeth_all if t["fdi"] not in M.get("hidden", [])]); ma = poly([M["planned"][q] for q in M["common"] if q < 30]); mh = poly(hid)
        far = cv2.dilate(np.maximum(mb, ma), np.ones((6 * k + 1, 6 * k + 1), np.uint8)) == 0   # بعيد عن أي سنة بتتحول (لثة/خلفية) + السنان الباقية من القبل
        f32 = lambda mk: cv2.GaussianBlur(mk.astype(np.float32), (0, 0), 1.5 * k)[..., None]
        er = lambda mk: cv2.erode(mk, np.ones((2 * k + 1, 2 * k + 1), np.uint8)) > 0
        _HI.update(k=k, G=(DB * f32(far | (mh > 0))).astype(np.float16), TB=(DB * f32(er(mb))).astype(np.float16), TA=(DA * f32(er(ma))).astype(np.float16), cache={}, ok=True)
        print(f"HIRES: detail layers ready (x{k})", flush=True)
    except Exception as e: print("HIRES failed (normal resolution used):", str(e)[:200], flush=True)
    return _HI if _HI["ok"] else None
def hi_frame(lo, prog):
    """lo: صورة المورف الملفوفة (الدقة العادية) ← نفس الصورة ×k بتفاصيل الحدة. بتتخزن لأول وآخر التحول (أغلب الفيديو)."""
    hd = hi_detail()
    if not hd: return None
    ps = [prog] if isinstance(prog, (int, float)) else list(prog.values()) or [0]
    st = 0 if max(ps) <= .02 else 1 if min(ps) >= .98 else None
    if st is not None and st in hd["cache"] and hd["cache"][st][0] is lo: return hd["cache"][st][1]
    k = hd["k"]; a = np.ascontiguousarray(np.rot90(np.asarray(lo), 1)); H, W = a.shape[:2]
    up = cv2.resize(a, (W * k, H * k), interpolation=cv2.INTER_CUBIC).astype(np.float32) + hd["G"]
    if st == 0: up += hd["TB"]
    elif st == 1: up += hd["TA"]
    out = rot(Image.fromarray(np.clip(up, 0, 255).astype(np.uint8)))
    if st is not None: hd["cache"][st] = (lo, out)
    return out
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
    _need_full()
    B = shot("B"); lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay); cc = current_contours(prog); M = morph_setup()
    for i, k in enumerate(M["order"]):
        q = ease(p * 1.4 - i * .05)
        if q <= 0: continue
        c_ = np.asarray(cc[k], np.float32).reshape(-1, 2)
        if len(c_) > 30:   # حد ناعم ماشي مع السنة: حدود القناع بكسل-بكسل كانت بتطلع الخط «مشرشر» (فيديو الحالة a03 ث2–5)
            w_ = max(5, (len(c_) // 60) | 1); pad_ = np.concatenate([c_[-w_:], c_, c_[:w_]]); ker_ = np.ones(w_, np.float32) / w_
            c_ = np.stack([np.convolve(pad_[:, 0], ker_, "same"), np.convolve(pad_[:, 1], ker_, "same")], 1)[w_:-w_]
        pts = [B.tf(x, y, z) for x, y in c_]; pts.append(pts[0]); d.line(anim.partial(pts, q), fill=col + (255,), width=width)
    return Image.alpha_composite(im.convert("RGBA"), lay).convert("RGB")
def morph_frame(prog, z=1.0, iso=1.0):
    _need_full()
    """العزل بيتبع شكل السنان في اللحظة دي: (عزل القبل) + (شكل كل سنة دلوقتي)."""
    B = shot("B"); M = morph_setup()
    if not hasattr(B, "_img0"): B._img0, B._iso0 = B.img, B.iso   # صورة القبل الأصلية (ملاحظة a30 5.6: المورف كان بيسيب صورة القبل المشتركة متغيرة للبعد، فأي مشهد قبل بعده طلع بسنان بيضا)
    B.img = morph_img(prog)
    hi_ = hi_frame(B.img, prog)
    if hi_ is not None: B._hi = (B.img, hi_)
    try:
        if iso > 0:
            m = M["isoB"].copy(); cc = current_contours(prog); cur = np.zeros_like(m)
            for k, c in cc.items():
                if k < 30: cv2.fillPoly(cur, [c.astype(np.int32)], 255)
            cur = cv2.morphologyEx(cur, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))   # حدود سنتين لازقين في بعض: من غير شعرة سودا بينهم (كانت بتبان فراغ بين ١١ و٢١)
            m = np.maximum(m, cv2.GaussianBlur(cur, (0, 0), 1.5))
            # حدود البعد أحيانًا بتاخد شريحة شفة/ظل عند الحافة القاطعة (بنية/غامقة مش سنة): بنحسب مرة واحدة على الصورة النهائية
            # (prog=1) البكسلات اللي مش لون سنة في النص السفلي *والمتصلة بالبرّا* (مش فتحات جوه السنة) ونشيلها من القناع في كل الفريمات
            # — كانت بتسيب شريط بني تحت الناب والرباعية. (مش بنحسبها على فريمات النص: المورف فيه خطوط لحام غامقة مؤقتة)
            if "cut" not in M and not os.environ.get("ISO_NOCUT"):
                cc1 = current_contours(1.0); cur1 = np.zeros_like(m)
                for k, c in cc1.items():
                    if k < 30: cv2.fillPoly(cur1, [c.astype(np.int32)], 255)
                m1 = np.maximum(M["isoB"], cv2.GaussianBlur(cur1, (0, 0), 1.5))
                im_ = np.asarray(morph_img(1.0, rotated=False)); lab_ = cv2.cvtColor(im_, cv2.COLOR_RGB2LAB)
                inside = m1 > 127
                cx_ = np.where(cur1.any(0))[0]; xs_ = np.arange(cx_.min(), cx_.max() + 1)   # النص السفلي من السنان بس (اللثة فوق وردية بطبيعتها)
                mid_ = np.array([np.mean(np.where(cur1[:, x] > 0)[0][[0, -1]]) if cur1[:, x].any() else np.nan for x in xs_])
                okm = ~np.isnan(mid_); mid_ = np.interp(np.arange(m.shape[1]), xs_[okm], mid_[okm])
                low_ = np.arange(m.shape[0])[:, None] > mid_[None, :]
                nontooth = (lab_[..., 0] < 110) | (lab_[..., 1] > 142); curd = cv2.dilate(cur1, np.ones((5, 5), np.uint8)) > 0
                dark = np.zeros(m.shape, bool)   # جوه حدود كل سنة: التلت السفلي اللي أغمق بكتير من السنة نفسها (شفة/ظل دخل في حد البعد)
                for k, c in cc1.items():
                    if k >= 30: continue
                    ck = np.zeros(m.shape, np.uint8); cv2.fillPoly(ck, [c.astype(np.int32)], 255); core = cv2.erode(ck, np.ones((9, 9), np.uint8)) > 0
                    if core.sum() < 50: continue
                    Lm = np.median(lab_[..., 0][core]); Am = np.median(lab_[..., 1][core]); y0_, y1_ = c[:, 1].min(), c[:, 1].max()
                    zone = (ck > 0) & ((np.arange(m.shape[0])[:, None] > y0_ + (y1_ - y0_) * .6) if k not in M.get("hidden", []) else True)
                    near = cv2.erode(inside.astype(np.uint8), np.ones((25, 25), np.uint8)) == 0   # حزام ١٢ بكسل من الخلفية: الرمادي الشفاف عند الحافة بيتقص برضه
                    dark |= zone & ((lab_[..., 0] < Lm - 35) | (lab_[..., 1] > Am + 8) | (near & (lab_[..., 0] < Lm - 22)))
                dark |= lab_[..., 1] > 146
                hid = np.zeros(m.shape, np.uint8)   # السنان الطرفية المغطاة جزئيًا: القص مسموح جوه حدودها كلها (الشفة/الظل اللي داخل فيها)
                for k in M.get("hidden", []):
                    if k in cc1: cv2.fillPoly(hid, [cc1[k].astype(np.int32)], 255)
                hid = cv2.dilate(hid, np.ones((9, 9), np.uint8)) > 0; low_ |= hid; M["hid"] = hid
                # في الفريم النهائي: النص السفلي برا حدود سنان البعد = مش سنة (أيًا كان لونه: سنة سفلية بيج باينة من الفراغ بين ٢٢ و٢٣ كانت بتعدي من فحص اللون)
                bad = inside & low_ & (~curd | (curd & (cv2.GaussianBlur(dark.astype(np.float32), (0, 0), 2) > .4)))
                n_, lb_ = cv2.connectedComponents((bad | ~inside).astype(np.uint8)); ids_ = set(np.unique(lb_[~inside])) - {0}
                cut = bad & np.isin(lb_, list(ids_)); cut = cv2.dilate(cut.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))) > 0   # يشيل معاه هالة الحافة الناعمة القديمة
                Bt_ = {t["fdi"]: t for t in B.teeth_all}; prot = np.zeros(m.shape, np.uint8)   # السنان الباقية من القبل (الضاحك): ما تتقصش أبدًا
                for k in M.get("hidden", []):
                    if k in Bt_: cv2.fillPoly(prot, [Bt_[k]["c"].astype(np.int32)], 255)
                import iso_qa
                cut &= cv2.dilate(iso_qa.grow_keep(prot, im_, 15).astype(np.uint8), np.ones((9, 9), np.uint8)) == 0   # حماية السنة الباقية بلونها الحقيقي (مش بس حدودها التقريبية)
                M["cut"] = cut & ((cur1 == 0) | (cv2.erode(cur1, np.ones((5, 5), np.uint8)) == 0)); M["cut_hid"] = cut & hid & ~M["cut"]
            if M.get("cut") is not None and (M["cut"].any() or M["cut_hid"].any()):
                p_ = max(0.0, min(1.0, prog if isinstance(prog, (int, float)) else max(prog.values() or [0])))   # القص محسوب من صورة البعد، فبيظهر مع المورف (صورة القبل زي ما هي)
                m = m.copy().astype(np.float32); m[(M["cut"] & (cv2.erode(cur, np.ones((5, 5), np.uint8)) == 0)) | M["cut_hid"]] *= 1 - p_
                m = cv2.GaussianBlur(m, (0, 0), 2.5).astype(np.uint8)
            # فحص العزل الأوتوماتيكي على كل فريم (iso_qa): بيلاقي البواقي/الخروم/اللثة الناقصة/السنان الناقصة لوحده، وبيصلّح الآمن
            import iso_qa
            Bt_ = {t["fdi"]: t for t in B.teeth_all}
            cons = [c for k, c in cc.items() if k < 30]; keep_ = [Bt_[k]["c"].astype(np.float32) for k in M.get("hidden", []) if k < 30 and k in Bt_]
            kq = round(float(prog if isinstance(prog, (int, float)) else max(prog.values() or [0])), 2)
            qc = M.setdefault("qa_cache", {}); ck_ = (kq if isinstance(prog, (int, float)) else str(sorted(prog.items())))
            if ck_ in qc: m, dq = qc[ck_]   # نفس خطوة المورف = نفس النتيجة (الزووم مالوش دعوة بالقناع) → الفحص مرة واحدة لكل خطوة
            else:
                img_ = np.ascontiguousarray(np.rot90(np.asarray(B.img), 1))
                src_ = np.ascontiguousarray(np.rot90(np.asarray(B._img0), 1))   # صورة القبل الحقيقية (مرجع للسنان الباقية واللثة)
                m, dq = iso_qa.check_and_verify(m, img_, cons, repair=not os.environ.get("ISO_QA_NOREPAIR"), keep=keep_, src_rgb=src_,
                                                old=[Bt_[k]["c"].astype(np.float32) for k in cc if k < 30 and k in Bt_] if (prog if isinstance(prog, (int, float)) else 1) >= .99 else ()); qc[ck_] = (m, dq)
                if dq: M.setdefault("qa_mask", {})[kq] = (m.copy(), img_)
            M.setdefault("qa_log", {})[kq] = dq
            if "qa_atexit" not in M:   # تقرير الفحص بيتكتب لوحده آخر الريندر (qa/iso_qa.json + صورة لأي عيب ما اتصلحش)
                M["qa_atexit"] = 1; import atexit; atexit.register(_iso_dump)
            B.iso = Image.fromarray(np.ascontiguousarray(np.rot90(m, -1)))
        return B.base(z, iso)
    finally: B.img, B.iso = B._img0, B._iso0   # يرجع القبل الحقيقي لأي حد بعده
def _iso_dump():
    try:
        import iso_qa, json as _j
        M = _M; log = M.get("qa_log", {}); qd = (CASE_DIR + "/qa/") if CASE_DIR else OUTD; os.makedirs(qd, exist_ok=True)
        allq = [dict(d, p=k) for k, v in sorted(log.items()) for d in v]; left = [d for d in allq if not d["fixed"]]
        kinds = {}
        for d in allq: kinds.setdefault(d["type"], [0, 0])[0 if d["fixed"] else 1] += 1
        _j.dump({"frames": len(log), "found": len(allq), "unfixed": len(left), "by_type": {k: {"fixed": a, "left": b} for k, (a, b) in kinds.items()},
                 "left": left[:50]}, open(qd + "iso_qa.json", "w"), ensure_ascii=False, indent=1)
        for d in left[:3]:   # صورة للعيوب اللي فضلت (للمراجعة)
            k = d["p"]
            if k in M.get("qa_mask", {}): m_, img_ = M["qa_mask"][k]; iso_qa.draw(img_, m_, [x for x in log[k] if not x["fixed"]], qd + f"iso_qa_left_{int(k * 100):03d}.jpg", rotate=-1)
        print(f"ISO_QA: {len(log)} فريم، {len(allq)} عيب، اتصلح {len(allq) - len(left)}، فاضل {len(left)}")
    except Exception as e: print("ISO_QA dump failed:", e)
    claude_review()
def claude_review(steps=(0, .5, 1)):
    """مراجعة Claude (مرتين + اتفاق) لفريمات العزل في أول/نص/آخر المورف → qa/claude_qa.json + الفريمات اللي اتراجعت.
    بتشتغل لوحدها آخر أي ريندر فيه مورف. CLAUDE_QA=0 يقفلها."""
    if os.environ.get("CLAUDE_QA", "1") == "0" or os.environ.get("CLAUDE_MORPH_QA", "0") != "1": return None   # مقفولة افتراضيًا: مراجعة الفيديو النهائي بتغطي نفس المشاهد (كانت نضيفة دايمًا من جولة 13) — توفير ~$0.30/فيديو
    try:
        import claude_qa, json as _j
        qd = (CASE_DIR + "/qa/") if CASE_DIR else OUTD; os.makedirs(qd, exist_ok=True)
        fr = {}
        for p in steps:
            im = auto_gum(morph_frame(p, 1.0)).convert("RGB"); k = f"p{int(p * 100):03d}"   # نفس الكادر اللي بيتعرض في الفيديو (اللثة ممدودة لحد الحافة) مش النسخة الخام; fr[k] = im; im.save(qd + f"claude_{k}.jpg", quality=90)
        rep = claude_qa.review_frames(fr)
        _j.dump(rep, open(qd + "claude_qa.json", "w"), ensure_ascii=False, indent=1)
        print(f"CLAUDE_QA: {rep['verdict']} — {rep['flagged']}/{len(fr)} فريم فيه عيب متفق عليه" + (f"، {rep['errors']} مراجعة فشلت" if rep["errors"] else ""))
        return rep
    except Exception as e: print("CLAUDE_QA failed:", e); return None
def iso_report(steps=(0, .25, .5, .75, 1)):
    """تقرير فحص العزل للحالة: بيمشي على خطوات المورف ويكتب qa/iso_qa.json + صورة مراجعة لكل خطوة فيها عيب لسه موجود.
    بيرجّع عدد العيوب اللي ما اتصلحتش (صفر = نضيف)."""
    import iso_qa, json as _j
    M = morph_setup(); B = shot("B"); qd = (CASE_DIR + "/qa/") if CASE_DIR else OUTD; os.makedirs(qd, exist_ok=True)
    rep = {}; left = 0
    for p in steps:
        morph_frame(p, 1.0); dq = M["qa_log"][round(float(p), 2)]; rep[str(p)] = dq
        rest = [d for d in dq if not d["fixed"]]; left += len(rest)
        if dq:
            m_, img_ = M["qa_mask"][round(float(p), 2)]
            iso_qa.draw(img_, m_, dq, qd + f"iso_qa_{int(p * 100):03d}.jpg", rotate=-1)
    _j.dump({"unfixed": left, "steps": rep}, open(qd + "iso_qa.json", "w"), ensure_ascii=False, indent=1)
    print(f"ISO_QA: {sum(len(v) for v in rep.values())} عيب، اتصلح {sum(len(v) for v in rep.values()) - left}، فاضل {left}")
    return left
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
        r = np.random.default_rng(seed); x0, y0, x1, y1 = box
        # توزيع سحابة (جاوسي حوالين نص المنطقة) مش مستطيل منتظم: كان بيبان مستطيل نقط بحروف مستقيمة (فلتر الفيديو: a30 ث9)
        s.p = np.c_[r.normal((x0 + x1) / 2, (x1 - x0) / 4.5, n), r.normal((y0 + y1) / 2, (y1 - y0) / 4.5, n)]
        a = r.uniform(0, 2 * np.pi, n); v = r.uniform(.2, 1, n) * speed; s.v = np.c_[np.cos(a) * v * spread + dirx * speed, np.sin(a) * v * spread + diry * speed]
        s.sz = r.uniform(3, 11, n); s.g = grav; arr = np.array(src) if src is not None else None
        s.c = [tuple(int(v) for v in arr[int(min(max(y, 0), arr.shape[0] - 1)), int(min(max(x, 0), arr.shape[1] - 1))]) if arr is not None else (col or (255, 255, 255)) for x, y in s.p]
    def draw(s, im, t, life=1.4):
        if t <= 0: return im
        lay = Image.new("RGBA", im.size); d = ImageDraw.Draw(lay); al = max(0, 1 - t / life)
        P = s.p + s.v * t; P[:, 1] += .5 * s.g * t * t
        for (x, y), z, c in zip(P, s.sz, s.c): d.ellipse((x, y, x + z, y + z), fill=c + (int(255 * al),))   # نقط مدوّرة (المربعات كانت بتبان بكسلات/رقعة: فلتر الفيديو test1 ث10)
        if getattr(s, "soft", 0): lay = lay.filter(ImageFilter.GaussianBlur(s.soft))
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
        pc = src.crop(box).convert("RGBA"); pc.putalpha(m.crop(box)); out.append((t["fdi"], piece_whole(pc, t["fdi"]), t["cx"], t["y"] + t["h"] / 2))
    return out
def piece_whole(pc, fdi=0, deep=.06):
    """أداة عامة (فحص + تصليح): قطعة السنة/العدسة اللي بتتعرض لوحدها لازم تبقى شكل كامل. لو حدودها فيها «قضمة» (اللثة أو سنة جارة
    مغطية ركن منها في الصورة، أو لمعة قطعت الحد) بتبان عدسة مكسورة/مقطوعة وهي طايرة (فيديو المكالمة الأولى a03 ث5: «notch torn»).
    الفحص: أعمق تجويف في الحد بالنسبة لعرض القطعة. التصليح: قفل التجويف، والجزء المتقفل بياخد لون وملمس السنة نفسها من جواها
    (مش بكسلات اللثة اللي كانت مغطياه). دي القطعة الطايرة بس: صورة المريض نفسها مابتتلمسش."""
    a = np.array(pc); al = (a[..., 3] > 127).astype(np.uint8); h, w = al.shape
    cs, _ = cv2.findContours(al, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not cs: return pc
    c = max(cs, key=cv2.contourArea)
    if len(c) < 20: return pc
    df = cv2.convexityDefects(c, cv2.convexHull(c, returnPoints=False)); dep = 0 if df is None else df.reshape(-1, 4)[:, 3].max() / 256
    if os.environ.get("PIECE_STRICT"): deep = .03   # التصليح التلقائي (REPAIRS): أي تجويف صغير في الحد بيتقفل
    if dep < deep * min(w, h): return pc
    cl = al.copy(); n_ = len(c)
    for s_, e_, f_, d_ in df.reshape(-1, 4):   # كل تجويف واضح بيتقفل لحد الخط المستقيم بين طرفيه (الحد الطبيعي للسنة محدّب)
        if not (deep * min(w, h) <= d_ / 256 <= .22 * min(w, h)): continue   # أعمق من كده = سنة جارة مغطية جزء كبير (مش قضمة): مايتخترعش
        seg = c[s_:e_ + 1] if e_ >= s_ else np.concatenate([c[s_:], c[:e_ + 1]])
        cv2.fillPoly(cl, [seg.reshape(-1, 2).astype(np.int32)], 1)
    cl = (cv2.GaussianBlur(cl.astype(np.float32), (0, 0), 2) > .5).astype(np.uint8)   # حد ناعم
    add = (cl > 0) & (al == 0)
    if add.sum() < .004 * al.sum(): return pc
    fix = (cv2.dilate(add.astype(np.uint8), np.ones((13, 13), np.uint8)) > 0) & (cl > 0)   # الجزء المتقفل + حرف السنة القديم اللي جنبه (كان وردي/غامق من اللثة ← خط لحام)
    core = cv2.erode(al, np.ones((5, 5), np.uint8)) & ~fix.astype(np.uint8)   # مصدر اللون: جوه السنة بس
    rgb = cv2.inpaint(np.ascontiguousarray(a[..., :3]), (core == 0).astype(np.uint8), 5, cv2.INPAINT_TELEA)
    a[..., :3] = np.where(fix[..., None], rgb, a[..., :3]); a[..., 3] = np.maximum(a[..., 3], (cv2.GaussianBlur(cl.astype(np.float32), (0, 0), 1) * 255).astype(np.uint8) * (cl > 0))
    print(f"piece_whole: tooth {fdi} outline notch {dep:.0f}px closed ({int(add.sum())} px)", flush=True)
    return Image.fromarray(a)
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
def auto_gum(im, dark=28, tol=0, rim=9, feather=3):   # tol=0: فراغ 2-3 بكسل عند الحافة كان بيتساب ← حزوز سودا صغيرة على حافة الكادر (فلتر الفيديو test1 ث18)
    """أداة عامة على مستوى الريندر (البلاي بوك E20/R4.1): أي كادر فيه فك معزول على إسود واللثة مش واصلة لحافة الشاشة اليمين
    ← الفراغ اللي بعد قوس اللثة بيتملي بنسيج لثة طبيعي بلون اللثة اللي جنبه. السنان واللثة الحقيقية مابيتلمسوش،
    والصفوف اللي مافيهاش فك بتفضل إسود. الكادرات اللي مش فك معزول بترجع زي ما هي."""
    a = np.asarray(im.convert("RGB")); H, W = a.shape[:2]; g = a.max(2) > dark
    if g[:, :int(W * .25)].mean() > .12: return im
    # حتت شفة/لحمة سايبة مش متصلة بالفك (بقايا العزل عند اللجام) بتتشال قبل الملء — كانت بتوقف الملء عندها وتسيب إسود بينها وبين اللثة
    # («تقطيع إسود في اللثة»: a06 16.4 — E460). الكلام والخطوط البيضا مابتتلمسش (مش وردي).
    g_br = cv2.morphologyEx(g.astype(np.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))   # بيقطع الكباري الرفيعة بين الحتة السايبة والفك
    n_c, lab_c, st_c, _ = cv2.connectedComponentsWithStats(g_br, 8)
    if n_c > 2:
        big_c = 1 + int(np.argmax(st_c[1:, 4])); hsv0 = cv2.cvtColor(a, cv2.COLOR_RGB2HSV); pk0 = ((hsv0[..., 0] > 150) | (hsv0[..., 0] < 10)) & (hsv0[..., 1] > 40)
        drop = np.zeros(g.shape, bool)
        for c_ in range(1, n_c):
            if c_ == big_c or st_c[c_, 4] > .03 * g.size: continue
            cm = lab_c == c_
            if pk0[cm].mean() > .5 and st_c[c_, 0] > W * .4: drop |= cm
        if drop.any():
            drop = cv2.dilate(drop.astype(np.uint8), np.ones((17, 17), np.uint8)) > 0; drop &= ~(cv2.dilate((lab_c == big_c).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0)
            a = a.copy(); a[drop] = 0; g = a.max(2) > dark
    hsv = cv2.cvtColor(a, cv2.COLOR_RGB2HSV); pink = (hsv[..., 0] > 150) & (hsv[..., 1] > 40) & (hsv[..., 2] > 90)   # لون اللثة (وردي/أحمر) — الكاست البيج بيبقى hue≈11 فمابيتحسبش
    if pink.mean() < .03 or pink.sum() < .12 * g.sum(): return im       # مش لثة (مثلًا كاست بيج)
    if np.where(pink)[1].mean() < W * .5: return im                    # اللثة مش ناحية اليمين
    thin = pink & g & ~(cv2.dilate(cv2.morphologyEx(g.astype(np.uint8), cv2.MORPH_OPEN, np.ones((7, 7), np.uint8)), np.ones((3, 3), np.uint8)) > 0)
    if thin.any():   # خيوط/شعر لثة رفيعة طالعة من حرف القوس (بقايا العزل) بتتشال — كانت بتبان «خيط لثة سايب» فوق آخر سنة (فلتر الفيديو test1 ث13-14)
        a = a.copy(); a[thin] = 0; g = a.max(2) > dark; pink = pink & ~thin
    body_rows = None; body = cv2.morphologyEx(pink.astype(np.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41)))   # جسم اللثة الأساسي
    n_, lab_, st_, _ = cv2.connectedComponentsWithStats(body, 8)
    if n_ > 1:
        big_ = [i for i in range(1, n_) if st_[i, 4] > .15 * st_[1:, 4].max()]   # كل أجزاء الجسم الكبيرة (اللثة ممكن تتقسم لجزئين عند رقبة رفيعة)
        by0 = min(st_[i, 1] for i in big_); by1 = max(st_[i, 1] + st_[i, 3] for i in big_)
        body_rows = (by0, by1)   # الامتداد بيشتغل جوه صفوف جسم اللثة الأساسي بس
    gs = cv2.morphologyEx(g.astype(np.uint8), cv2.MORPH_OPEN, np.ones((9, 9), np.uint8)) > 0   # الخطوط الرفيعة في أي اتجاه (مسطرة، عقرب الساعة، قوس) مابتتحسبش محتوى — كانت بتقطع ملء اللثة وتسيب إسود على شكلها (a03 9.3 و15.1)
    has = gs.sum(1) > W * .05; xr = W - 1 - np.argmax(gs[:, ::-1], axis=1)
    # حافة اللثة «النضيفة»: آخر الشريط الوردي المتصل بعد آخر سنة (مش آخر حتة محتوى) — الحرف المسنن وبقايا الشفة الغامقة بعده
    # كانت بتتعكس بلوكات غامقة بحرف مستقيم («تقطيع إسود في اللثة»: a06 16.4 — E460). اللي بعد الحافة النضيفة بيتملي لثة.
    pk_cl = cv2.morphologyEx(pink.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((1, 7), np.uint8)) > 0
    tt_ = cv2.morphologyEx(((a.astype(np.int16).mean(2) > 120) & ~pink).astype(np.uint8), cv2.MORPH_OPEN, np.ones((9, 9), np.uint8)) > 0
    for y in np.where(has)[0]:
        tx_ = np.where(tt_[y])[0]; x_s = int(tx_.max()) + 3 if len(tx_) else int(np.argmax(pk_cl[y])) if pk_cl[y].any() else -1
        if x_s < 0 or x_s >= xr[y]: continue
        run = pk_cl[y, x_s:xr[y] + 1]; nz = np.where(~run)[0]
        st_ = int(np.argmax(run)) if run.any() else None
        if st_ is None: continue
        after = np.where(~run[st_:])[0]
        if len(after) and st_ + after[0] > 20: xr[y] = x_s + st_ + int(after[0]) - 1
    # حرف القناع الغامق: القناع أحيانًا بيزيد كام بكسل بعد اللثة الوردية (ضل/شفة غامقة). الحافة اللي الملء بيبدأ منها = آخر بكسل لثة فعلًا،
    # وإلا الصف كان بيتحسب «آخره مش لثة» فمايتملاش ويفضل هلال إسود يمين اللثة (فيديو الحالة a03 ث0–9)
    for y in np.where(has)[0]:
        x1_ = int(xr[y]); x0_ = max(0, x1_ - 60); ix_ = np.where(pink[y, x0_:x1_ + 1])[0]
        if len(ix_) and (x1_ - (x0_ + int(ix_[-1]))) > 3: xr[y] = x0_ + int(ix_[-1])
    gap = (W - 1) - xr
    rows = has & (gap > tol) & (gap < W * .35)
    if body_rows is not None:   # جوه جسم اللثة: صف حافته بعيدة (نتوء/حتة لثة ناقصة عند الثنايا) بيتملي برضه — كان بيفضل شريط إسود/رمادي أفقي جنب الفك (E456 a06 18.3)
        yy0 = np.arange(H); rows |= has & (gap > tol) & (gap < W * .6) & (yy0 >= body_rows[0]) & (yy0 < body_rows[1])
    if body_rows is not None:   # حتة لثة صغيرة فوق/تحت آخر سنة (مش جسم اللثة) كانت بتتمد لحد الحافة ← شريط لثة سايب (فلتر الفيديو test1 ث13-14)
        yy_ = np.arange(H); edge_pink_ = np.array([pink[y, max(0, int(xr[y]) - 14):int(xr[y]) + 1].sum() >= 4 for y in range(H)])
        rows &= ((yy_ >= body_rows[0]) & (yy_ < body_rows[1])) | edge_pink_   # بره جسم اللثة: الصف بيتملي لو حافته لثة حقيقية (اللثة الرفيعة جنب آخر بريمولارز — الكادر بقى بيقف عند آخر لثة: E457)
    hr = np.where(has)[0]
    band = len(hr) > 0 and (0 < hr[0] < H * .07 or 0 < H - 1 - hr[-1] < H * .07)
    if rows.sum() < 3 and not band: return im   # مفيش فراغ يمين ولا شريط فوق/تحت (اللثة واصلة للحافة اليمين بس الشريط اللي فوق لسه محتاج يتملي — كان بيرجع هنا بدري)
    T = gum_texture(H)
    if T is None:   # مفيش خلفية لثة جاهزة للحالة (حالة بصورتين بس): النسيج الأساسي = لون لثة المريض نفسه، والملء بييجي من انعكاس لثته (كان بيرجع من غير ملء ← إسود يمين اللثة)
        gp_ = pink & g
        if gp_.sum() < 200: return im
        T = np.tile(a[gp_].astype(np.float32).mean(0)[None, None, :], (H, 64, 1))
    if not os.environ.get("GUM_TEXTURE"): rim = max(rim, 24)   # محور الانعكاس جوه اللثة بعيد عن حرفها الغامق (كان الحرف بيبان خط رمادي رأسي في نص الامتداد: test1 ث14)
    x0 = np.clip(xr - rim, 0, W - 1).astype(np.float32); Ht, Wt = T.shape[:2]
    # صف آخره سنة مش لثة (آخر سنتين في القوس): الملء يبدأ بعد السنة، مايتكتبش فوقها — البداية قبل الحافة بـ rim كانت
    # بتنسخ صف جار فوق طرف السنة ← سنان ممطوطة بشرايط أفقية تحت الفك (E446: a08/a11، مسكتها مراجعة Claude)
    for y in np.where(rows)[0]:
        xe = int(xr[y])
        if pink[y, max(0, xe - 16):max(1, xe - 4)].sum() < 3: x0[y] = min(W - 1, xe + 1)
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
    if not os.environ.get("GUM_TEXTURE"):
        # الامتداد من لثة نفس المريض: انعكاس (رايح جاي) لشريط اللثة اللي قبل الحافة في نفس الصف — نفس اللون والملمس بالظبط من غير خط فاصل.
        # (النسيج الجاهز كان بيطلع رقعة مختلفة الملمس بحرف مستقيم على يمين الفك: srv/test1 ث14-23)
        wb = np.zeros(H, np.float32)
        for y in np.where(rows)[0]:
            x1_ = int(x0[y]); seg = pink[y, max(0, x1_ - 400):x1_][::-1]
            wb[y] = np.argmin(seg) if (~seg).any() else len(seg)
        ok_ = rows & (wb >= 12)
        if ok_.sum() >= 3:
            wbs = cv2.GaussianBlur(np.where(ok_, wb, 0)[:, None].astype(np.float32), (1, 0), sigmaX=1, sigmaY=25)[:, 0] / np.maximum(cv2.GaussianBlur(ok_[:, None].astype(np.float32), (1, 0), sigmaX=1, sigmaY=25)[:, 0], 1e-3)
            mir = fill.copy(); pk_f = pink.astype(np.float32)
            gavg_ = cv2.GaussianBlur(af * pk_f[..., None], (0, 0), 18) / np.maximum(cv2.GaussianBlur(pk_f, (0, 0), 18), 1e-3)[..., None]   # لون لثة المريض المحلي
            for y in np.where(rows)[0]:
                w_ = max(12, int(wbs[y] * .55)); x1_ = int(x0[y]); d = np.arange(W - x1_)
                pp = d % (2 * w_); pp = np.where(pp < w_, pp, 2 * w_ - 1 - pp)
                src = np.clip(x1_ - 1 - pp, 0, W - 1); ps_ = (pink[y, src] & (af[y, src].mean(1) > 115))[:, None]   # لثة فاتحة بس (حرف القناع الغامق كان بيتعكس «تقطيع إسود» في اللثة: a06 16.4)
                mir[y, x1_:] = np.where(ps_, af[y, src], gavg_[y, src])   # بكسل مش لثة في المصدر ← متوسط لثة المريض اللي حواليه (النسيج الجاهز كان فيه علامات سودا بتتكرر «x x x»: a07 11.3)
                seg_ = mir[y, x1_:x1_ + 2 * w_]; dev_ = gavg_[y, x1_:x1_ + 2 * w_].mean() - seg_.mean() if len(seg_) else 0
                if dev_ > 14: mir[y, x1_:] = gavg_[y, x1_:]   # صف مصدره غامق عن اللثة اللي حواليه (لجام/ثنية): بياخد لون اللثة المحلي بدل ما يتعكس بلوكات غامقة بحرف مستقيم (E460: a06 16.4)   # بنعكس اللثة بس: بكسل سنة/ظل في المصدر بياخد نسيج اللثة (كان بيطلع شريط بني وإسود جنب الفك: E456 a06 18.3)
            # صفوف آخر القوس اللي مافيهاش لثة (حافة اللثة الحقيقية خلصت قبل آخر سنتين): بتاخد امتداد أقرب صف فيه لثة —
            # اللثة بتكمل ورا السنان الطرفية بدل نسيج جاهز (كان بيطلع شرايط رمادي فوق آخر سنتين: test1 بعد)
            # صفوف آخر القوس اللي مافيهاش لثة حقيقية (حافة اللثة خلصت قبل آخر سنتين): مابتتملاش — القوس بيخلص طبيعي على الإسود زي الحقيقة.
            # (ملء من نسيج جاهز كان بيطلع شرايط رمادي، وتكرار/انعكاس صفوف كان بيطلع شرايط وخط فاصل: test1 بعد)
            # صف جوه اللثة (فوقه وتحته لثة في حدود 40 بكسل) بس عنده خرم صغير عند الحافة: بياخد امتداد أقرب صف سليم
            # (كان بيتساب فاضي ← شرايط سودا أفقية في اللثة الممدودة: test1 ث13)
            oky = np.where(ok_)[0]
            if len(oky):
                for y in np.where(rows & ~ok_)[0]:
                    up_ = oky[oky < y]; dn_ = oky[oky > y]
                    inb_ = body_rows is not None and body_rows[0] <= y < body_rows[1] and (len(up_) or len(dn_))   # جوه جسم اللثة: أقرب صف سليم مهما بعد (لثة رفيعة عند الثنايا كانت بتسيب شريط إسود أفقي: E456 a06 18.3)
                    if (len(up_) and len(dn_) and y - up_[-1] <= 40 and dn_[0] - y <= 40) or inb_:
                        cand_ = ([up_[-1]] if len(up_) else []) + ([dn_[0]] if len(dn_) else [])
                        yo = min(cand_, key=lambda v: abs(v - y)); x1_ = int(x0[y]); xo = max(int(x0[yo]), x1_)   # مانرجعش لورا جوه محتوى الصف ده
                        mir[y, max(x1_, xo):] = mir[yo, max(x1_, xo):]
                        if x1_ < xo: mir[y, x1_:xo] = af[yo, x1_:xo]
                        ok_[y] = True
            ok_ = cv2.dilate(ok_.astype(np.uint8)[:, None], np.ones((3, 1), np.uint8))[:, 0] > 0
            rows = rows & ok_
            mir = cv2.GaussianBlur(mir, (0, 0), sigmaX=.6, sigmaY=2.2)   # بين الصفوف بس (من غير ما يضيع الملمس)
            # بعد أول انعكاس: الملمس بيتنعّم تدريجيًا لحد لون لثة هادي — تكرار الانعكاس كان بيبان طيّات وخطوط رأسية (test1 ث14)
            dd = xs - x0[:, None]; ww = np.maximum(12, wbs * .55)[:, None]; kb = np.clip((dd - ww) / (2 * ww), 0, 1)[..., None] * .85
            mir = mir * (1 - kb) + cv2.GaussianBlur(mir, (0, 0), 14) * kb
            fill = np.where(rows[:, None, None], mir, fill)
    # درجات اللون بين الصفوف: كل صف بيعكس لثة صفه، فالصفوف اللي عند ملتقى سنتين (أغمق) كانت بتطلع شرايط أفقية بحرف مستقيم
    # («رقع لثة ملزوقة»: فحص الفيديو a03 ث24–25). اللون العام بيتنعّم رأسيًا، والملمس الدقيق بيفضل.
    f_lo = cv2.GaussianBlur(fill, (0, 0), 4); fill = cv2.GaussianBlur(f_lo, (0, 0), sigmaX=2, sigmaY=22) + (fill - f_lo) * .7
    m = ((xs >= x0[:, None]) & rows[:, None]).astype(np.float32)
    m = cv2.GaussianBlur(m, (0, 0), feather if os.environ.get("GUM_TEXTURE") else max(feather, 7))[..., None]   # دمج أعرض عند بداية الانعكاس (مايبانش خط)
    out = af * (1 - m) + fill * m
    if not os.environ.get("GUM_TEXTURE") and body_rows is not None:
        # فوق آخر سنة وتحت أول سنة: اللثة بتكمل لحد حافة الكادر فوق/تحت (طلب الطبيب: مفيش إسود فوق اللثة وتحتها) —
        # انعكاس رأسي (رايح جاي) من لثة المريض نفسه في جسم اللثة، يمين السنان بس. السنان مابتتلمسش.
        by0, by1 = body_rows; hb = max(8, by1 - by0); o_ = out.copy(); vm = np.zeros((H, W), np.float32)

        tooth_ = cv2.morphologyEx(((a.astype(np.int16).mean(2) > 110) & ~pink).astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)) > 0   # السنان بس (فاتحة) — الحرف الغامق حوالين السنة بيتملي لثة (كان بيفضل خط إسود رفيع)
        sh_ = 14; by0i, by1i = by0 + sh_, by1 - sh_; hb = max(8, by1i - by0i)   # محور الانعكاس جوه اللثة بعيد عن حرفها الغامق (كان بيطلع خط غامق أفقي)
        toothd_ = cv2.dilate(tooth_.astype(np.uint8), np.ones((15, 15), np.uint8)) > 0; x_ = np.arange(W)
        empty_ = int(sum(1 for y in list(range(0, by0)) + list(range(by1, H)) if tooth_[y].sum() < 6))   # صفوف فوق/تحت جسم اللثة مفيهاش سنان خالص
        if empty_ > .15 * H:   # E457: الفك أقصر من الشاشة بكتير والباقي لثة ممدودة فوق وتحت (شكل مش منطقي) — قرّب الفك لحد ما يوصل للحافتين
            qa_warn("E457", f"لثة ممدودة فوق/تحت الفك {100 * empty_ / H:.0f}% من طول الشاشة — كبّر الفك يوصل لحافة الشاشة")
        tooth_x1 = np.array([(np.where(toothd_[y])[0].max() + 1) if toothd_[y].any() else 0 for y in range(H)])   # آخر بكسل سنة في كل صف (اللثة بتبدأ بعده)
        by0e, by1e = by0 + 14, by1 - 14
        edge_t = int(tooth_x1[by0e:by0e + 60].max()) if by1e - by0e > 60 else 0; edge_b = int(tooth_x1[max(by0e, by1e - 60):by1e].max()) if by1e - by0e > 60 else 0   # حد مستقيم بعد آخر سنة (مش متعرّج على شكل السنان المنعكسة)
        gl_body = np.median([np.where(pink[y])[0].min() for y in range(by0, by1) if pink[y].any()] or [W * .6])
        for y in (list(range(0, by0i)) + list(range(by1i, H))) if VERT_EXT else []:   # اتلغى (طلب الطبيب): حد الكادر فوق وتحت = نهاية الفك، مفيش امتداد ولا اختراع — الكادر نفسه بيتقص على الفك (anim.Shot.base)
            d_ = (by0i - y) if y < by0i else (y - by1i + 1)
            k_ = d_ % (2 * hb); k_ = k_ if k_ < hb else 2 * hb - 1 - k_
            ys = min(by1i - 1, by0i + k_) if y < by0i else max(by0i, by1i - 1 - k_)
            tx = np.where(tooth_[y])[0]
            x0r = int(tx.min() + .5 * (tx.max() - tx.min())) if len(tx) else int(gl_body * .9)   # النص ناحية اللثة من السنان (الجيوب اللي ناحية الحافة القاطعة تفضل إسود)
            row = (~tooth_[y]); row[:x0r] = False
            own_ = int(np.where(tooth_[y])[0].max()) + 3 if tooth_[y].any() else (edge_t if y < by0i else edge_b)   # الصف فيه سنة: اللثة تبدأ بعدها على طول (من غير إسود/أبيض بينهم)
            row = (~tooth_[y]) & (x_ >= own_) & ~tooth_[ys]   # وبكسل سنة في الصف المصدر مابيتنسخش (اللثة بس اللي بتتمد)   # اللثة بس اللي بتتمد: أي بكسل سنة (أو جنب سنة / ناحية الحافة القاطعة) في الصف المصدر مابيتنسخش — كان بيعمل سنان مخترعة بعد 14 و24 (E456: a06 18.3)
            if y >= by0 and y < by1: row &= (a[y].astype(np.int16).mean(1) < 90) & ~pink[y]   # شريط حرف الجسم: نملا الإسود والحرف الغامق بس (كان بيفضل خط إسود أفقي)
            o_[y, row] = out[ys, row]; vm[y, row] = 1
        if vm.any():   # بعد الانعكاس الملمس بيتنعّم تدريجيًا (التماثل حوالين المحور مايبانش)
            dist_ = np.zeros(H, np.float32); dist_[:by0i] = np.arange(by0i, 0, -1); dist_[by1i:] = np.arange(1, H - by1i + 1)
            kb_ = np.clip(dist_ / max(1, hb), 0, 1)[:, None, None] * .75; o_ = o_ * (1 - kb_) + cv2.GaussianBlur(o_, (0, 0), 10) * kb_
            far = np.abs(np.arange(H) - np.clip(np.arange(H), by0, by1 - 1)).astype(np.float32)[:, None, None]
            o_ = np.where(far > hb * .5, o_ * 0 + cv2.GaussianBlur(o_, (0, 0), 6), o_) if False else o_
            vm = cv2.GaussianBlur(vm, (0, 0), 4)[..., None]; out = out * (1 - vm) + o_ * vm
            # الحرف الغامق الأصلي عند أول/آخر صف في جسم اللثة (بين السنة واللثة الممدودة): بيتملي من النسيج اللي حواليه
            ink = np.zeros((H, W), np.uint8); ob = np.clip(out, 0, 255).astype(np.uint8)
            for yb in (by0, by1):
                for y in range(max(0, yb - 30), min(H, yb + 30)):
                    tx = np.where(tooth_[y])[0]; x0r = int(tx.min() + .5 * (tx.max() - tx.min())) if len(tx) else 0
                    d_ = (ob[y].astype(np.int16).mean(1) < 80); d_[:x0r] = False; d_ &= ~tooth_[y]; ink[y] = d_
            if ink.any(): out = cv2.inpaint(ob, cv2.dilate(ink, np.ones((3, 3), np.uint8)), 5, cv2.INPAINT_TELEA).astype(np.float32)
            # جزر إسود صغيرة مقفولة جوه اللثة (مش متوصلة بالخلفية السودا الشمال): بتتملي — كانت بتبان «نقط/خروم سودا في اللثة» (فلتر الفيديو test1 ث13)
            ob = np.clip(out, 0, 255).astype(np.uint8); blk = (ob.max(2) < 70).astype(np.uint8); n_b, lb_b, st_b, _ = cv2.connectedComponentsWithStats(blk, 4)
            bgc = set(np.unique(lb_b[:, 0])) | set(np.unique(lb_b[:, :int(W * .3)][blk[:, :int(W * .3)] > 0]))
            holes = np.isin(lb_b, [i for i in range(1, n_b) if i not in bgc and st_b[i, 4] < H * W * .002 and st_b[i, 0] > W * .45])
            if holes.any(): out = cv2.inpaint(ob, cv2.dilate(holes.astype(np.uint8), np.ones((11, 11), np.uint8)), 9, cv2.INPAINT_TELEA).astype(np.float32)
    # شريط رفيع **فوق** الفك (< 7% من الطول) بيبان زي حافة إسود بعد ما اللثة وصلت للحافة اليمين (E84)
    # ← اللثة بس (من بعد آخر سنة) بتكمل لفوق بانعكاس اللثة اللي تحت الشريط مباشرة — بعد ملء فراغ اليمين. السنان مابتتعكسش، واللي تحت الفك مابيتلمسش.
    hr = np.where(has)[0]
    if len(hr) and 0 < hr[0] < H * .07 and os.environ.get("GUM_TEXTURE"):   # (قديم) شد اللثة لفوق: مع نهاية القوس الطبيعية بقى بيطلع شريط رمادي (test1 ث14)
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
    # فجوات سودا جوه شريط اللثة (بين آخر سنة وحافة المحتوى في نفس الصف — عند اللجام) بتتملي من اللثة اللي حواليها (E460: a06 16.4)
    ob_ = np.clip(out, 0, 255).astype(np.uint8); hs2 = cv2.cvtColor(ob_, cv2.COLOR_RGB2HSV)
    hs0_ = cv2.cvtColor(a, cv2.COLOR_RGB2HSV)
    th_ = cv2.morphologyEx(((a.astype(np.int16).mean(2) > 120) & (hs0_[..., 1] < 90)).astype(np.uint8), cv2.MORPH_OPEN, np.ones((15, 15), np.uint8)) > 0   # السنان الحقيقية بس (من الصورة الأصلية، من غير الحتت البيضا الصغيرة)
    gm_ = (hs2[..., 0] > 150) & (hs2[..., 1] > 40) & (hs2[..., 2] > 90)
    lt_ = np.where(th_.any(1), W - 1 - np.argmax(th_[:, ::-1], axis=1), W)
    gr_ = np.where(gm_.any(1), W - 1 - np.argmax(gm_[:, ::-1], axis=1), -1)
    xs2 = np.arange(W)[None, :]
    hole = (ob_.astype(np.int16).mean(2) < 70) & (xs2 > lt_[:, None] + 6) & (xs2 < gr_[:, None] - 2)
    hole = cv2.morphologyEx(hole.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    if hole.mean() > .0005: out = cv2.inpaint(ob_, cv2.dilate(hole, np.ones((7, 7), np.uint8)), 9, cv2.INPAINT_TELEA).astype(np.float32)
    # E456 (تحذير بس، من غير تلوين): أي لون سنة ظهر مكان كان إسود = الملء اخترع سنة
    ob_ = np.clip(out, 0, 255).astype(np.uint8); hsv_ = cv2.cvtColor(ob_, cv2.COLOR_RGB2HSV); hh_, ss_ = hsv_[..., 0], hsv_[..., 1]
    toothc_ = (ob_.astype(np.int16).mean(2) > 100) & ((ss_ < 30) | ((hh_ >= 8) & (hh_ <= 35) & (ss_ < 120)))
    new_tooth = cv2.morphologyEx((toothc_ & (a.max(2) <= dark)).astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)) > 0
    if new_tooth.mean() > .002: qa_warn("E456", f"ملء اللثة طلّع سنان مخترعة ({new_tooth.mean() * 100:.1f}% من الكادر)")
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
AUTO_GUM = os.environ.get("AUTO_GUM", "1") != "0"
VERT_EXT = os.environ.get("VERT_EXT") == "1"   # امتداد اللثة فوق/تحت الفك: مقفول (E457)
def post(im, W=FW, H=FH):
    """نفس المعالجة اللي الريندر بيعملها لكل كادر (المقاس + ملء اللثة التلقائي). أي معاينة لمشهد لازم تعدّي عليها،
    وإلا المعاينة بتختلف عن الفيديو (E453: معاينة من غير ملء خلّتني أشيل ملء صح، فطلع فراغ إسود في الفيديو)."""
    im = im.resize((W, H)) if im.size != (W, H) else im
    return auto_gum(im) if (AUTO_GUM and not im.info.get("no_auto_gum")) else im
def preview(scenes, ts, out, w=216):
    """شيت معاينة بأوقات عامة في الفيديو، كادرات زي الريندر بالظبط (post)."""
    starts = np.cumsum([0] + [d for d, _ in scenes]); ims = []
    for t in ts:
        i = max(0, min(len(scenes) - 1, int(np.searchsorted(starts, t, "right") - 1))); ims.append(post(scenes[i][1](t - starts[i])).resize((w, int(w * FH / FW))))
    sh = Image.new("RGB", (w * len(ims), ims[0].height))
    for k, im in enumerate(ims): sh.paste(im, (k * w, 0))
    sh.save(out); return out
def render(name, scenes, music="piano", W=FW, H=FH, xfade=0.0, still=False):
    """scenes: [(المدة, دالة(t_محلي) → صورة)]"""
    starts = np.cumsum([0] + [d for d, _ in scenes]); DUR = float(starts[-1])
    def frame(t):
        i = max(0, min(len(scenes) - 1, int(np.searchsorted(starts, t, "right") - 1))); lt = t - starts[i]; im = scenes[i][1](lt)
        if xfade and i + 1 < len(scenes) and lt > scenes[i][0] - xfade: im = blend(im, scenes[i + 1][1](0), (lt - (scenes[i][0] - xfade)) / xfade)
        return post(im, W, H)   # مشهد بيملا اللثة بنفسه قبل الحركة (زي خروج الفك من الكادر) بيقفل الملء التلقائي   # البلاي بوك R4.1: مفيش فراغ إسود يمين الفك المعزول في أي قالب
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
    p.stdin.close(); p.wait()
    if os.environ.get("CLAUDE_QA", "1") != "0" and os.path.exists(out):   # مراجعة الفيديو النهائي نفسه بـ Claude (كل ثانية، مرتين + اتفاق) → qa/claude_video.json
        try:
            import claude_qa; qd = (CASE_DIR + "/qa/") if CASE_DIR else OUTD; os.makedirs(qd, exist_ok=True)
            rv = claude_qa.review_video(out, qd + "claude_video.json")
            import shutil; shutil.copy(qd + "claude_video.json", qd + f"claude_video_{os.path.basename(out).rsplit('.', 1)[0]}.json")   # نسخة لكل قالب (الأساسي بيتكتب عليه في الريندر اللي بعده)
            print(f"CLAUDE_VIDEO: {rv['verdict']} — {len(rv['agreed'])} عيب متفق عليه في {rv['seconds']} ثانية" + (f"، {rv['errors']} مراجعة فشلت" if rv["errors"] else ""), flush=True)
        except Exception as e: print("CLAUDE_VIDEO failed:", e, flush=True)
    return out
def dur(p): return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p], capture_output=True, text=True).stdout or 0)
def compare(name, ref):
    out = OUTD + "cmp_" + name + ".mp4"; rp = S + f"up/{ref}/in/v.mp4"
    if os.path.exists(out):   # النسخة القديمة (اللي ممكن يكون عليها تعليق في المعرض) بتتحفظ قبل ما تتستبدل — علشان نعاير الفحوصات عليها (E438)
        import shutil, time as _t; os.makedirs(OUTD + "prev", exist_ok=True); shutil.copy(out, OUTD + f"prev/cmp_{name}_{_t.strftime('%m%d_%H%M', _t.localtime(os.path.getmtime(out)))}.mp4")
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
