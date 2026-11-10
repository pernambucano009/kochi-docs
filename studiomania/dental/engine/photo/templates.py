"""قوالب الصور p01–p09 — بوستات صور عادية (1080×1350، 4:5).

كل صورة في القالب بتتقص بتحويل واحد (تدوير+مقاس+نقل) بيودّي «نقطتين مرجع» (زاويتين البق في صور الابتسامة،
طرفين صف السنان في صور المبعّد/الجنب) على نفس المكان في اللوحة ← القبل والبعد والتحضير بنفس المقاس والمكان.
مفيش أي تعديل على السنان أو الألوان. العزل على أسود (p08/p09) = إخفاء الخلفية بس بحدود SAM.

الاستخدام:  python3 templates.py <قالب> <brand.json> <out> before=... after=... [prep=...]
"""
import os, sys, json, math, cv2, numpy as np
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import lib, mouth
from lib import PhotoError

W, H = 1080, 1350


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


def canvas(): return Image.new("RGB", (W, H), (0, 0, 0))


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
def p02(before, after, brand, **k): return stacked(before, after, brand, "teeth", .80)    # قبل وبعد: بالمبعّد
def p03(before, after, brand, **k): return stacked(before, after, brand, "teeth", .78)    # قبل وبعد: من الجنب


def p04(before, after, brand, **k):   # المرآة الطولية: قبل يسار (أطراف السنان يمين) وبعد يمين (أطراف السنان يسار)، شريط أسود في النص
    sw = 200; pw = (W - sw) // 2
    (lft, rgt), _ = panels([anchors(before, "teeth"), anchors(after, "teeth")], pw, H, "v", .74, orients=["ccw", "cw"])
    cv = canvas(); paste(cv, lft, 0, 0); paste(cv, rgt, pw + sw, 0)
    lib.paste_logo(cv, brand, W / 2, H * .5, w=int(H * .42), rot=90)   # اللوجو بالطول في الشريط
    if brand.get("name_en"): lib.spaced_v(cv, brand["name_en"], W / 2 + 72, H * .12, H * .88, 12, (255, 255, 255, 130))
    return cv


def p05(after, brand, **k):   # الماكرو بالتوقيع: سنتين/تلاتة قدام قريب قوي + علامة مائية
    A = anchors(after, "teeth"); c = (A["l"] + A["r"]) / 2; v = (A["r"] - A["l"]); u = v / np.linalg.norm(v)
    half = np.linalg.norm(v) * .17          # تقريبًا عرض الثنيتين
    A2 = dict(img=A["img"], l=c - u * half, r=c + u * half)
    (im,), _ = panels([A2], W, H, "h", .9, cyk=.5)
    cv = Image.fromarray(im); d = ImageDraw.Draw(cv, "RGBA")
    if brand.get("name_en"):
        n = brand["name_en"].split(); mid = (len(n) + 1) // 2
        for i, line in enumerate([" ".join(n[:mid]), " ".join(n[mid:])]):
            if line: lib.spaced(d, line, 200, W - 200, H * .76 + i * 34, 18, (255, 255, 255, 115))
    lib.paste_logo(cv, brand, 150, H - 90, h=80)
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


def p06(before, prep, after, brand, **k): return three(before, prep, after, brand, "strips")   # المراحل الثلاث: شرائط
def p07(before, prep, after, brand, **k): return three(before, prep, after, brand, "rows")     # المراحل الثلاث: صفوف


def cut(path):
    A = anchors(path, "teeth"); c, m = lib.cutout(A["img"]); return dict(A, img=c)


def p08(after, brand, **k):   # الأسنان على الأسود: السنان واللثة بس، واللوجو كبير تحت
    (im,), _ = panels([cut(after)], W, H, "h", .84, cyk=.36, black=True)
    cv = Image.fromarray(im); d = ImageDraw.Draw(cv, "RGBA")
    if brand.get("name_en"): lib.spaced(d, brand["name_en"], 60, W - 60, H * .62, 12, (255, 255, 255, 120))
    lib.paste_logo(cv, brand, W * .3, H * .82, h=150)
    return cv


def p09(before, after, brand, **k):   # قبل وبعد على الأسود، واللوجو في النص
    ph = H // 2 - 60
    (top, bot), _ = panels([cut(before), cut(after)], W, ph, "h", .82, cyk=.5, black=True)
    cv = canvas(); paste(cv, top, 0, 0); paste(cv, bot, 0, H - ph)
    lib.paste_logo(cv, brand, W / 2, H / 2, h=110)
    return cv


TEMPLATES = {"p01": (p01, ["before", "after"]), "p02": (p02, ["before", "after"]), "p03": (p03, ["before", "after"]),
             "p04": (p04, ["before", "after"]), "p05": (p05, ["after"]), "p06": (p06, ["before", "prep", "after"]),
             "p07": (p07, ["before", "prep", "after"]), "p08": (p08, ["after"]), "p09": (p09, ["before", "after"])}

def make(tid, brand, out, **photos):
    fn, need = TEMPLATES[tid]
    miss = [n for n in need if not photos.get(n)]
    if miss: raise PhotoError("MISSING_PHOTO: ناقص " + ", ".join(miss))
    im = fn(brand=brand, **{n: photos[n] for n in need}); im.save(out, quality=95); return [out]


if __name__ == "__main__":
    tid, brand_p, out = sys.argv[1:4]; kv = dict(a.split("=", 1) for a in sys.argv[4:])
    try:
        o = make(tid, json.load(open(brand_p)), out, **kv)
        print(json.dumps({"ok": True, "out": o, "logo_low_contrast": lib.LOGO_LOW[0]}, ensure_ascii=False))
    except PhotoError as e: print(json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False)); sys.exit(2)
