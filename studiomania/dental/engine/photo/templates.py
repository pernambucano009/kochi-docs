"""قوالب الصور p01–p09 — بوستات صور عادية (1080×1350، 4:5).

كل صورة في القالب بتتقص بتحويل واحد (تدوير+مقاس+نقل) بيودّي «نقطتين مرجع» (زاويتين البق في صور الابتسامة،
طرفين صف السنان في صور المبعّد/الجنب) على نفس المكان في اللوحة ← القبل والبعد والتحضير بنفس المقاس والمكان.
مفيش أي تعديل على السنان أو الألوان. العزل على أسود (p08/p09) = إخفاء الخلفية بس بحدود SAM.

الاستخدام:  python3 templates.py <قالب> <brand.json> <out> before=... after=... [prep=...]
"""
import os, sys, json, math, cv2, numpy as np
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import lib, mouth, grade, upper
from lib import PhotoError

W, H = 1080, 1350
GRADE = [None]; GRADE_REP = [None]   # ثيم ألوان الأصل للقالب الحالي (grade.py)


# ---------- نقط المرجع ----------
def anchors(path, kind):
    """kind = smile (زاويتين البق الداخليتين) | teeth (طرفين صف السنان + ميله)."""
    if kind == "smile":
        R = mouth.analyze(path); return dict(img=R["img"], l=R["l"], r=R["r"])
    a = lib.load(path); mk = lib.teeth_mask(a); ys, xs = np.where(mk)
    # العرض من السنان + اللثة اللي لازقة فيها (السنان نفسها بتتغير بين المراحل: تحضير/قبل/بعد، اللثة لأ)
    lab = cv2.cvtColor(a, cv2.COLOR_RGB2LAB); pink = (lab[..., 1] > 138) & (lab[..., 0] > 50)
    th_ = max(5, int(np.ptp(ys) * .35)); near = cv2.dilate(mk.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (th_ * 2 + 1, th_ * 2 + 1))) > 0
    un = mk | (pink & near); uy, ux = np.where(un)
    x0, x1 = np.percentile(ux, 1), np.percentile(ux, 99)
    hl, hr = xs < np.median(xs), xs >= np.median(xs)
    th = math.atan2(ys[hr].mean() - ys[hl].mean(), xs[hr].mean() - xs[hl].mean()) if hl.sum() > 20 and hr.sum() > 20 else 0.0
    th = float(np.clip(th, -math.radians(5), math.radians(5)))   # ميل أكتر من ٥° غالبًا غلط قياس (قوس مش متماثل)، مش ميل كاميرا
    c = np.array([(x0 + x1) / 2, ys.mean()]); w = (x1 - x0) / 2
    u = np.array([math.cos(th), math.sin(th)])
    return dict(img=a, l=c - u * w, r=c + u * w, mask=mk)


def targets(cx, cy, ow, orient):
    """مكان النقطتين في اللوحة. orient: h أفقي، ccw الصورة متلفّة عكس عقارب الساعة (أطراف السنان يمين)، cw العكس."""
    if orient == "h": return np.array([cx - ow / 2, cy]), np.array([cx + ow / 2, cy])
    if orient == "ccw": return np.array([cx, cy + ow / 2]), np.array([cx, cy - ow / 2])
    return np.array([cx, cy - ow / 2]), np.array([cx, cy + ow / 2])


def panels(As, pw, ph, orient="h", fill=.6, cyk=None, black=False, orients=None):
    """لوحة pw×ph لكل صورة بنفس المقاس والمكان. لو مش على أسود: أصغر مقاس يغطي اللوحة كلها في الكل."""
    orients = orients or [orient] * len(As)
    if GRADE[0]:   # E462: نفس ثيم ألوان الأصل، نفس التحويل للكل، والسنان مابتتلمسش
        ms = [A.get("mask") if A.get("mask") is not None else lib.teeth_mask(A["img"]) for A in As]
        ims, GRADE_REP[0] = grade.apply([A["img"] for A in As], ms, GRADE[0])
        As = [dict(A, img=im) for A, im in zip(As, ims)]
    # صورة متصورة على خلفية سودا (كونتراستور) أو معزولة قبل كده: الحواف السودا طبيعية، مش لازم نكبّر عشان نغطيها
    black = black or any((cv2.cvtColor(A["img"][::4, ::4], cv2.COLOR_RGB2GRAY) < 22).mean() > .22 for A in As)
    span = pw if orient == "h" else ph
    cands = [cyk] if cyk is not None else sorted(np.arange(.28, .72, .02), key=lambda k: abs(k - .45))
    ow = span * fill
    for _ in range(60):
        for k in cands:
            Ms = []
            for A, o in zip(As, orients):
                cx, cy = (pw / 2, ph * k) if orient == "h" else (pw * k, ph / 2)
                L, R = targets(cx, cy, ow, o); Ms.append(lib.similarity(A["l"], A["r"], L, R))
            if black or all(lib.covered(M, A["img"].shape, pw, ph) for M, A in zip(Ms, As)):
                for M, A in zip(Ms, As):
                    if lib.scale_of(M) > 4: raise PhotoError("PHOTO_LOW_RES: صورة صغيرة قوي، محتاجين صورة أقرب/أوضح")
                return [lib.warp(A["img"], M, pw, ph, black) for M, A in zip(Ms, As)], ow
        ow *= 1.03
    raise PhotoError("PHOTO_TOO_TIGHT: الصورة مقصوصة قريب قوي، مش هتملا الإطار")


def canvas(w=None, h=None): return Image.new("RGB", (w or W, h or H), (0, 0, 0))


def paste(cv, arr, x, y): cv.paste(Image.fromarray(arr), (int(x), int(y)))


# ---------- القوالب ----------
BAND = 34


def stacked(before, after, brand, kind, fill):
    ph = (H - BAND) // 2
    (top, bot), _ = panels([anchors(before, kind), anchors(after, kind)], W, ph, "h", fill)
    cv = canvas(); paste(cv, top, 0, 0); paste(cv, bot, 0, ph + BAND)
    d = ImageDraw.Draw(cv, "RGBA")
    # العلامة المائية: دايمًا اسم الطبيب بالإنجليزي، حروف صغيرة متباعدة وشفافة شوية
    if brand.get("name_en"): lib.spaced(d, brand["name_en"], 28, W - 28, ph + BAND / 2, 13, (255, 255, 255, 150))
    return lib.footer(cv, brand, W, H)


def p01(before, after, brand, **k): return stacked(before, after, brand, "smile", .62)    # قبل وبعد: الابتسامة
def snap(im, side="top", mid=.6, scale=1.0):
    """E464: فك معزول على أسود مايبقاش «طاير» — اللثة لازم توصل لحافة اللوحة (فوق للفك اللي فوق، تحت للي تحت، شمال/يمين للصور المتلفّة).
    بنزق الصورة لحد ما أوطى نقطة في حافة اللثة (في النص mid من العرض) تبقى على الحافة بالظبط؛ scale>1 بيكبّر الأول عشان اللثة تغطي عرض أكبر."""
    k = {"top": 0, "left": 1, "bottom": 2, "right": 3}[side]
    a = np.ascontiguousarray(np.rot90(im, {0: 0, 1: -1, 2: 2, 3: 1}[k]))
    h, w = a.shape[:2]
    if scale != 1.0:
        b = cv2.resize(a, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC); x0 = (b.shape[1] - w) // 2; a = b[:h, x0:x0 + w] if b.shape[0] >= h else a
    g = a.max(2) > 14; c0, c1 = int(w * (1 - mid) / 2), int(w * (1 + mid) / 2)
    tops = [np.argmax(g[:, x]) for x in range(c0, c1) if g[:, x].any()]
    if tops:
        t = int(np.percentile(tops, 95)); a = np.vstack([a[t:], np.zeros((t, w, 3), a.dtype)])
        # Q26 (E464): بعد الزق لسه فيه أسود فوق اللثة في نص الصورة؟
        g2 = a.max(2) > 14; fl = float(np.mean([np.argmax(g2[:, x]) > h * .02 for x in range(c0, c1) if g2[:, x].any()] or [0]))
        if fl > .2: upper.WARN.append(f"Q26 GUM_FLOAT: {fl:.0%} من نص اللوحة فيه أسود فوق اللثة")
    return np.ascontiguousarray(np.rot90(a, {0: 0, 1: 1, 2: 2, 3: -1}[k]))


def iso(path, arch="upper", refl=.18, force=False):
    """E463: صورة مبعّد ← فك واحد (upper/lower) على أسود. لو متصورة على كونتراستور (الفك التاني مش باين) بتفضل زي ما هي إلا لو force."""
    A = anchors(path, "teeth")
    if force or upper.needs_isolation(A["img"]):
        img, tm = upper.isolate(A["img"], arch, refl); A = dict(A, img=img, mask=tm, isolated=True)
    return A


def p02(before, after, brand, arch="upper", **k):   # قبل وبعد بالمبعّد: فك واحد على أسود + انعكاس خفيف تحت السنان
    ph = (H - BAND) // 2
    As = [iso(before, arch), iso(after, arch)]
    (top, bot), _ = panels(As, W, ph, "h", .80)
    sd = "top" if arch == "upper" else "bottom"
    top, bot = [snap(x, sd) if A.get("isolated") else x for x, A in zip((top, bot), As)]
    cv = canvas(); paste(cv, top, 0, 0); paste(cv, bot, 0, ph + BAND)
    d = ImageDraw.Draw(cv, "RGBA")
    if brand.get("name_en"): lib.spaced(d, brand["name_en"], 28, W - 28, ph + BAND / 2, 13, (255, 255, 255, 150))
    return lib.footer(cv, brand, W, H)
def p03(before, after, brand, **k): return stacked(before, after, brand, "teeth", .78)    # قبل وبعد: من الجنب


def p04(before, after, brand, **k):   # المرآة الطولية: قبل يسار (أطراف السنان يمين) وبعد يمين (أطراف السنان يسار)، شريط أسود في النص
    sw = 200; pw = (W - sw) // 2
    arch = k.get("arch", "upper")   # فك فوق قبل/بعد، أو فك تحت قبل/بعد — من صور المبعّد، معزولين على أسود ومتقابلين
    (lft, rgt), _ = panels([iso(before, arch, refl=0, force=True), iso(after, arch, refl=0, force=True)], pw, H, "v", .74, orients=["ccw", "cw"], black=True)
    ga, gb = ("left", "right") if arch == "upper" else ("right", "left")   # اللثة لحافة الصورة من برا
    lft, rgt = snap(lft, ga), snap(rgt, gb)
    cv = canvas(); paste(cv, lft, 0, 0); paste(cv, rgt, pw + sw, 0)
    lib.paste_logo(cv, brand, W / 2, H * .5, w=int(H * .42), rot=90)   # اللوجو بالطول في الشريط
    if brand.get("name_en"): lib.spaced_v(cv, brand["name_en"], W / 2 + 72, H * .12, H * .88, 12, (255, 255, 255, 130))
    return cv


def _upscale_for(path, scale):
    """الماكرو محتاج تفاصيل: لو هنكبّر الصورة أكتر من ١.٢٥× بنعمل تكبير أمين (faithful_upscale) الأول. بيرجع (مسار، نسبة)."""
    if scale <= 1.25: return path, 1.0
    try:
        import shutil, tempfile; sys.path.insert(0, os.path.join(os.path.dirname(HERE), "tools"))
        from faithful_upscale import upscale_small
        tmp = os.path.join(tempfile.mkdtemp(), "macro.jpg"); shutil.copy(path, tmp)
        w0, w1 = upscale_small(tmp, min_w=int(Image.open(path).width * min(scale, 4)), passes=2)
        return tmp, w1 / w0
    except Exception as e:
        print("MACRO_UPSCALE_FAILED", str(e)[:120], file=sys.stderr); return path, 1.0


def p05(after, brand, **k):   # الماكرو بالتوقيع: صورة مبعّد بالعرض، السنان متلفّة (أطرافها شمال) على ناحية واحدة، قريب قوي + لوجو + علامة مائية
    A = anchors(after, "teeth"); c = (A["l"] + A["r"]) / 2; v = (A["r"] - A["l"]); u = v / np.linalg.norm(v)
    half = np.linalg.norm(v) * .3          # الثنيتين والجانبيتين والناب تقريبًا على طول الصورة
    fill = .95; scale = H * fill / (2 * half)
    p2, f = _upscale_for(after, scale)
    if f != 1.0: A = dict(A, img=lib.load(p2)); c, half = c * f, half * f
    A2 = dict(img=A["img"], l=c - u * half, r=c + u * half)
    (im,), _ = panels([A2], W, H, "v", fill, cyk=.6, orients=["cw"])
    cv = Image.fromarray(im); d = ImageDraw.Draw(cv, "RGBA")
    lib.paste_logo(cv, brand, W * .2, H * .5, w=int(H * .42), rot=90, alpha=.9)   # اللوجو: بالطول على ناحية البق
    if brand.get("name_en"):   # العلامة المائية: اسم الطبيب بالإنجليزي، كبير ومتباعد وشفاف تحت — حاجة غير اللوجو
        n = brand["name_en"].split(); mid = (len(n) + 1) // 2
        for i, line in enumerate([" ".join(n[:mid]), " ".join(n[mid:])]):
            if line: lib.spaced(d, line, 40, W - 40, H * .84 + i * 62, 40, (255, 255, 255, 70))
    return cv


def three(before, prep, after, brand, layout):
    As = [anchors(p, "teeth") for p in (before, prep, after)]
    cv = canvas()
    if layout == "strips":   # 3 شرائط بالطول (أطراف السنان يمين) + اللوجو تحت
        g = 14; pw = (W - 2 * g) // 3; ph = H - 170
        ims, _ = panels(As, pw, ph, "v", .86, orients=["ccw"] * 3, black=True)
        for i, im in enumerate(ims): paste(cv, im, i * (pw + g), 0)
        lib.paste_logo(cv, brand, W / 2, H - 85, h=86)
    else:                    # 3 صفوف فوق بعض على أسود
        g = 22; ph = (H - 170 - 2 * g) // 3
        ims, _ = panels(As, W, ph, "h", .86, black=True)
        for i, im in enumerate(ims): paste(cv, im, 0, i * (ph + g))
        lib.paste_logo(cv, brand, W / 2, H - 85, h=86)
    return cv


def p06(before, prep, after, brand, **k):   # المراحل الثلاث بالطول 9:16 (1080×1920): 3 صفوف فوق بعض على أسود + اللوجو كبير بالعرض تحت
    W6, H6 = 1080, 1920; g = 14; LG = 430; ph = (H6 - LG - 2 * g) // 3
    As = [anchors(p, "teeth") for p in (before, prep, after)]
    ims, _ = panels(As, W6, ph, "h", .9, black=True)
    cv = canvas(W6, H6)
    for i, im in enumerate(ims): paste(cv, im, 0, i * (ph + g))
    lib.paste_logo(cv, brand, W6 / 2, H6 - LG / 2, w=int(W6 * .62))
    return cv
def p07(before, prep, after, brand, **k): return three(before, prep, after, brand, "rows")     # المراحل الثلاث: صفوف


def cut(path):
    A = anchors(path, "teeth"); c, m = lib.cutout(A["img"]); return dict(A, img=c)


def p08(after, brand, **k):   # الأسنان على الأسود: السنان واللثة بس، واللوجو كبير تحت
    ph = int(H * .64)   # الفك فوق خالص واللثة لحد حافة الصورة (E464)، واللوجو كبير في الأسود تحت
    (im,), _ = panels([iso(after, refl=0, force=True)], W, ph, "h", 1.12, cyk=.5, black=True)   # الفك مالي العرض زي الأصل
    cv = canvas(); paste(cv, snap(im, "top"), 0, 0); d = ImageDraw.Draw(cv, "RGBA")
    if brand.get("name_en"): lib.spaced(d, brand["name_en"], 60, W - 60, ph * .62, 12, (255, 255, 255, 120))
    lib.paste_logo(cv, brand, W * .5, ph + (H - ph) / 2, w=int(W * .6))
    return cv


def p09(before, after, brand, **k):   # قبل وبعد على الأسود، واللوجو في النص
    ph = H // 2 - 60
    (top, bot), _ = panels([iso(before, refl=0, force=True), iso(after, refl=0)], W, ph, "h", .9, cyk=.5, black=True)
    cv = canvas(); paste(cv, snap(top, "top"), 0, 0); paste(cv, snap(bot, "top"), 0, H - ph)   # E464: اللثة لحافة كل لوحة
    lib.paste_logo(cv, brand, W / 2, H / 2, h=110)
    return cv


TEMPLATES = {"p01": (p01, ["before", "after"]), "p02": (p02, ["before", "after"]), "p03": (p03, ["before", "after"]),
             "p04": (p04, ["before", "after"]), "p05": (p05, ["after"]), "p06": (p06, ["before", "prep", "after"]),
             "p07": (p07, ["before", "prep", "after"]), "p08": (p08, ["after"]), "p09": (p09, ["before", "after"])}

def make(tid, brand, out, **photos):
    fn, need = TEMPLATES[tid]
    miss = [n for n in need if not photos.get(n)]
    if miss: raise PhotoError("MISSING_PHOTO: ناقص " + ", ".join(miss))
    GRADE[0] = None if os.environ.get("NO_GRADE") else grade.load(tid)
    opts = {n: v for n, v in photos.items() if n not in ("before", "prep", "after")}   # arch=upper|lower ...
    im = fn(brand=brand, **{n: photos[n] for n in need}, **opts); im.save(out, quality=95); return [out]


if __name__ == "__main__":
    tid, brand_p, out = sys.argv[1:4]; kv = dict(a.split("=", 1) for a in sys.argv[4:])
    try:
        o = make(tid, json.load(open(brand_p)), out, **kv)
        print(json.dumps({"ok": True, "out": o, "logo_low_contrast": lib.LOGO_LOW[0], "grade": GRADE_REP[0], "warnings": upper.WARN}, ensure_ascii=False))
    except PhotoError as e: print(json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False)); sys.exit(2)
