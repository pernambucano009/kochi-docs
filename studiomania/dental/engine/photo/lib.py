"""مكتبة قوالب الصور: تحميل، ظبط صورتين بنفس الزاوية على بعض، قص على السنان، عزل السنان على أسود، وهوية الدكتور.

قواعد ثابتة:
  - مفيش أي تعديل على السنان ولا ألوانها: قص/تدوير/تكبير/تصغير/عزل الخلفية بس.
  - صورتين (قبل/بعد/تحضير) لازم بنفس زاوية الكاميرا: الظبط بيتعمل بملامح الصورة (شفايف، جلد، لثة، مبعّد)،
    ولو الملامح ماتطابقتش (زاوية مختلفة) ← ANGLE_MISMATCH بدل ما نطلع مقارنة مضللة.
"""
import os, sys, math, cv2, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps
HERE = os.path.dirname(os.path.abspath(__file__)); S = os.path.dirname(HERE) + "/"
sys.path.insert(0, HERE); sys.path.insert(0, S + "tools"); sys.path.insert(0, S + "ana")
def _fontpath(*names):
    """الخط من فولدر خطوط المحرك، أو خطوط المنصة (DENTAL_FONTS أو studiomania/fonts)."""
    dirs = [S + "fonts/", os.environ.get("DENTAL_FONTS") or "", os.path.join(S, "..", "..", "fonts", "")]
    for n in names:
        for d in dirs:
            if d and os.path.exists(os.path.join(d, n)): return os.path.join(d, n)
    raise PhotoError("FONT_MISSING: " + names[0])


class _F:   # الخطوط بتتحدد أول ما تتطلب (عشان استيراد المكتبة مايفشلش لو الخط مش موجود)
    def __getattr__(self, k):
        return {"AR": lambda: _fontpath("IBMPlexSansArabic-SemiBold.ttf", "TY-PlexArabic-700.ttf"),
                "AR_R": lambda: _fontpath("IBMPlexSansArabic-Regular.ttf", "TY-PlexArabic-400.ttf"),
                "EN": lambda: _fontpath("Jost.ttf", "SM-Plex.ttf", "TY-PlexArabic-400.ttf")}[k]()


FONTS = _F()


class PhotoError(RuntimeError):
    pass


def load(p):
    return np.array(ImageOps.exif_transpose(Image.open(p)).convert("RGB"))


def font(p, size):
    return ImageFont.truetype(p, size, layout_engine=ImageFont.Layout.RAQM)


# ---------- السنان ----------
ROI = [None]


def face_roi(a):
    """مربع البق لو الوش باين (نقط الوش)، وإلا None."""
    try:
        from derive import _lmk
        P = _lmk(a)
    except Exception:
        return None
    x0, y0 = P[[61, 291, 0, 17]].min(0); x1, y1 = P[[61, 291, 0, 17]].max(0); w = x1 - x0
    return [max(0, x0 - w * .25), max(0, y0 - w * .25), x1 + w * .25, y1 + w * .3]


def teeth_mask(a, roi="auto"):
    ROI[0] = face_roi(a) if roi == "auto" else roi
    return _teeth_mask(a)


def _teeth_mask(a):
    """قناع تقريبي للسنان (فاتح ومش أحمر) — أكبر حتة + اللي قريب منها. للقص والظبط بس، مش للعزل الدقيق."""
    h, w = a.shape[:2]; k = 800 / max(h, w); sm = cv2.resize(a, (max(1, int(w * k)), max(1, int(h * k))), interpolation=cv2.INTER_AREA)
    lab = cv2.cvtColor(sm, cv2.COLOR_RGB2LAB).astype(np.float32); L, A, B = lab[..., 0], lab[..., 1], lab[..., 2]
    # "سِنّية": فاتح، ومش أحمر (لثة/شفايف)، ومش أصفر غامق زي الجلد
    T = L - 2.6 * np.maximum(A - 128, 0) - .5 * np.maximum(B - 145, 0)
    v = T[L > 45]
    thr, _ = cv2.threshold(np.clip(v, 0, 255).astype(np.uint8).reshape(-1, 1), 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    t = (T > max(thr, 95)) & (L > 70)
    t = cv2.morphologyEx(t.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    t = cv2.morphologyEx(t, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    Hs, Ws = t.shape
    if ROI[0] is not None:   # الوش باين: نحصر في منطقة البق بنقط الوش
        x0, y0, x1, y1 = (np.array(ROI[0]) * k).astype(int); r = np.zeros_like(t); r[y0:y1, x0:x1] = 1; t = t & r
    n, lb, st, cen = cv2.connectedComponentsWithStats(t)
    ok = []
    for i in range(1, n):
        x, y, ww, hh, ar = st[i]
        edges = (x <= 1) + (y <= 1) + (x + ww >= Ws - 1) + (y + hh >= Hs - 1)
        if edges >= 2 and (ww < Ws * .97 or hh > Hs * .5): continue   # جلد فاتح/حيطة لازقة في حافتين = مش سنان
        ok.append(i)
    if not ok: raise PhotoError("NO_TEETH: مالقيناش سنان في الصورة")
    big = max(ok, key=lambda i: st[i, 4]); keep = np.zeros_like(t, bool)
    by0, bh = st[big, 1], st[big, 3]
    for i in ok:
        y, hh = st[i, 1], st[i, 3]
        near = (y + hh > by0 - bh * 1.2) and (y < by0 + bh * 2.2)   # قريب من صف السنان الأساسي (الفك التاني مسموح)
        if st[i, 4] >= st[big, 4] * .08 and near and (st[i, 2] < Ws * .95 or i == big): keep |= lb == i
    return cv2.resize(keep.astype(np.uint8), (w, h), interpolation=cv2.INTER_NEAREST) > 0


def teeth_box(a, mk=None):
    mk = teeth_mask(a) if mk is None else mk
    ys, xs = np.where(mk)
    return np.array([np.percentile(xs, 1), np.percentile(ys, 1), np.percentile(xs, 99), np.percentile(ys, 99)], np.float64)


# ---------- ظبط صورتين على بعض ----------
def _gray(a, k):
    g = cv2.cvtColor(cv2.resize(a, None, fx=k, fy=k, interpolation=cv2.INTER_AREA), cv2.COLOR_RGB2GRAY)
    return cv2.createCLAHE(2.0, (8, 8)).apply(g)


def align(ref, mov, min_inliers=25):
    """تحويل (تدوير+مقاس+نقل) بيودّي mov على ref. بيرجع (M 2×3، معلومات). الأساس ملامح الصورة (SIFT)،
    والسنان نفسها مستبعدة (اتغيرت بالعلاج). لو المطابقة ضعيفة ← ANGLE_MISMATCH."""
    k1 = 1200 / max(ref.shape[:2]); k2 = 1200 / max(mov.shape[:2])
    g1, g2 = _gray(ref, k1), _gray(mov, k2)
    m1 = (~cv2.resize(cv2.dilate(teeth_mask(ref).astype(np.uint8), np.ones((15, 15), np.uint8)), g1.shape[::-1]).astype(bool)).astype(np.uint8) * 255
    m2 = (~cv2.resize(cv2.dilate(teeth_mask(mov).astype(np.uint8), np.ones((15, 15), np.uint8)), g2.shape[::-1]).astype(bool)).astype(np.uint8) * 255
    sift = cv2.SIFT_create(4000)
    kp1, d1 = sift.detectAndCompute(g1, m1); kp2, d2 = sift.detectAndCompute(g2, m2)
    info = dict(method="sift", inliers=0)
    if d1 is not None and d2 is not None and len(kp1) > 10 and len(kp2) > 10:
        mt = cv2.BFMatcher().knnMatch(d2, d1, k=2)
        good = [m for m, n in (x for x in mt if len(x) == 2) if m.distance < .75 * n.distance]
        if len(good) >= 8:
            p2 = np.float32([kp2[m.queryIdx].pt for m in good]) / k2; p1 = np.float32([kp1[m.trainIdx].pt for m in good]) / k1
            M, inl = cv2.estimateAffinePartial2D(p2, p1, method=cv2.RANSAC, ransacReprojThreshold=max(ref.shape[:2]) * .006, maxIters=5000, confidence=.995)
            if M is not None:
                ni = int(inl.sum()); s = math.hypot(M[0, 0], M[1, 0]); ang = math.degrees(math.atan2(M[1, 0], M[0, 0]))
                info.update(inliers=ni, ratio=round(ni / len(good), 2), scale=round(s, 3), angle=round(ang, 2))
                if ni >= min_inliers and .3 < s < 3.5 and abs(ang) < 25:
                    return M, info
    raise PhotoError(f"ANGLE_MISMATCH: الصورتين مش بنفس زاوية الكاميرا (أو مش لنفس الحالة) — تطابق {info.get('inliers', 0)} نقطة")


# ---------- قص ----------
def similarity(l, r, L, R):
    v, V = np.asarray(r, float) - l, np.asarray(R, float) - L
    s = np.linalg.norm(V) / np.linalg.norm(v); a = math.atan2(V[1], V[0]) - math.atan2(v[1], v[0])
    c, si = s * math.cos(a), s * math.sin(a)
    M = np.array([[c, -si, 0], [si, c, 0]], np.float64); M[:, 2] = np.asarray(L, float) - M[:, :2] @ l
    return M


def compose_M(A, B):
    """A بعد B (الاتنين 2×3)."""
    A3 = np.vstack([A, [0, 0, 1]]); B3 = np.vstack([B, [0, 0, 1]]); return (A3 @ B3)[:2]


def frame_box(box, W, H, fill=.78, cy=.5, rot=0):
    """تحويل بيحط مربع السنان (x0,y0,x1,y1) في نص لوحة W×H بعرض fill منها (أو ارتفاع لو rot=±90)."""
    x0, y0, x1, y1 = box; c = np.array([(x0 + x1) / 2, (y0 + y1) / 2]); bw, bh = x1 - x0, y1 - y0
    if rot in (90, -90):
        s = min(W * fill / bh, H * fill / bw)
    else:
        s = min(W * fill / bw, H * fill / bh)
    a = math.radians(rot); M = np.array([[s * math.cos(a), -s * math.sin(a), 0], [s * math.sin(a), s * math.cos(a), 0]])
    M[:, 2] = np.array([W / 2, H * cy]) - M[:, :2] @ c
    return M


def covered(M, shape, W, H):
    Mi = cv2.invertAffineTransform(M); q = np.array([[0, 0], [W, 0], [0, H], [W, H]], float) @ Mi[:, :2].T + Mi[:, 2]
    h, w = shape[:2]
    return bool((q[:, 0] >= -1).all() and (q[:, 0] <= w).all() and (q[:, 1] >= -1).all() and (q[:, 1] <= h).all())


def warp(a, M, W, H, black=False):
    s = math.hypot(M[0, 0], M[1, 0])
    out = cv2.warpAffine(a, M, (int(W), int(H)), flags=cv2.INTER_LANCZOS4 if s > 1 else cv2.INTER_AREA,
                         borderMode=cv2.BORDER_CONSTANT if black else cv2.BORDER_REPLICATE, borderValue=(0, 0, 0))
    if s > 1.5:   # حدة خفيفة بس (موديل التكبير بيغيّر السنان = ممنوع)
        bl = cv2.GaussianBlur(out, (0, 0), 1.6); out = np.clip(out * 1.45 - bl * .45, 0, 255).astype(np.uint8)
    return out


def fit_shared(imgs, Ms, W, H, box, rot=0, cy=.5, fill=.78, allow_black=False):
    """إطار واحد للكل (نفس المقاس والمكان): الصور كلها متظبطة على الأولى (Ms)، فنفس الإطار يتطبق.
    لو حواف فاضية ← نكبّر لحد ما تتغطى (أو نسيبها سودا لو القالب على أسود)."""
    f = fill
    for _ in range(40):
        F = frame_box(box, W, H, f, cy, rot)
        if allow_black or all(covered(compose_M(F, M), a.shape, W, H) for a, M in zip(imgs, Ms)): return F
        f *= 1.04
    raise PhotoError("PHOTO_TOO_TIGHT: الصورة مقصوصة قريب قوي، مش هتملا الإطار")


def scale_of(M): return math.hypot(M[0, 0], M[1, 0])


def check_res(Ms_full, names):
    for M, n in zip(Ms_full, names):
        if scale_of(M) > 4: raise PhotoError(f"PHOTO_LOW_RES: صورة {n} صغيرة قوي، محتاجين صورة أوضح/أقرب")


# ---------- عزل السنان (واللثة) على أسود ----------
def cutout(a, with_gum=True):
    """السنان (+اللثة) بس على أسود، بحدود SAM على بكسلات الصورة نفسها. بيرجع (صورة، قناع)."""
    mk = teeth_mask(a); H, W = a.shape[:2]
    try:
        import sam21
        E = sam21.embed(a)
    except Exception:   # موديل SAM مش موجود على السيرفر: قناع السنان باللون بس (أقل دقة في الحدود)
        E = None
    x0, y0, x1, y1 = teeth_box(a, mk)
    # نقط موجبة على السنان (مركز كل حتة كبيرة)
    dt = cv2.distanceTransform(mk.astype(np.uint8), cv2.DIST_L2, 5)
    r = max(8, int((x1 - x0) / 20)); pk = (dt == cv2.dilate(dt, np.ones((2 * r + 1, 2 * r + 1), np.uint8))) & (dt > r * .4)
    ys, xs = np.where(pk); pts = sorted(zip(xs, ys), key=lambda p: -dt[p[1], p[0]])[:14]
    tm = np.zeros((H, W), bool)
    for (x, y) in (pts if E is not None else []):
        m, sc = sam21.masks_from_points(E, [(float(x), float(y))])
        mb = m > .5
        if sc > .6 and mb.sum() < H * W * .25: tm |= mb
    tm = tm | mk
    out = tm.copy()
    if with_gum:
        # اللثة: الشريط الوردي اللي لازق في السنان (فوقها/تحتها) — SAM بمربع حوالين السنان ممدود
        lab = cv2.cvtColor(a, cv2.COLOR_RGB2LAB).astype(np.float32); A = lab[..., 1]; L = lab[..., 0]
        pink = (A > 140) & (L > 60) & ~tm
        band = np.zeros_like(pink); bh = (y1 - y0)
        band[int(max(0, y0 - bh * .6)):int(min(H, y1 + bh * .6)), int(max(0, x0 - (x1 - x0) * .03)):int(min(W, x1 + (x1 - x0) * .03))] = True
        g = pink & band
        g = cv2.morphologyEx(g.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
        n, lb = cv2.connectedComponents(g)
        near = cv2.dilate(tm.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
        keep = set(np.unique(lb[near & (lb > 0)])) - {0}
        out = tm | np.isin(lb, list(keep))
    if E is None:   # من غير SAM: GrabCut (تقسيم بالألوان والحواف من OpenCV) بيبدأ من قناع اللون ويظبط الحدود على الصورة نفسها
        out, tm = _grab(a, tm, out, (x0, y0, x1, y1))
    out = _smooth_fill(out)
    tm = tm & out
    if not with_gum:
        soft = cv2.GaussianBlur(tm.astype(np.float32), (0, 0), 1.2)[..., None]
        return (a * soft).astype(np.uint8), tm
    return gum_expand(a, tm)


def gum_expand(a, tm):
    """اللثة امتداد ناعم فوق السنان: شريط منتظم بارتفاع ثابت فوق خط اللثة، حافته العليا منحنى ناعم.
    جوه الشريط: لون اللثة الحقيقي، واللي مش لثة (شفة/مبعد/ضل) بيتملي من نسيج اللثة اللي جنبه (inpaint).
    السنان نفسها مابتتلمسش."""
    H, W = a.shape[:2]
    tm = _smooth_fill(tm) if tm.any() else tm
    ys, xs = np.where(tm)
    if not len(xs): return a * 0, tm
    x0, x1 = int(np.percentile(xs, .5)), int(np.percentile(xs, 99.5))
    th = float(np.percentile(ys, 95) - np.percentile(ys, 5))          # ارتفاع صف السنان
    top = np.full(W, np.nan)
    for x in range(x0, x1 + 1):
        c = np.where(tm[:, x])[0]
        if len(c): top[x] = c.min()
    xx = np.arange(W); ok = ~np.isnan(top)
    top = np.interp(xx, xx[ok], top[ok])
    # خط اللثة الناعم (بيعدّي فوق الفراغات بين السنان) والحافة العليا للشريط
    k = max(5, int((x1 - x0) * .06)) | 1
    line = cv2.erode(top.astype(np.float32).reshape(1, -1), np.ones((1, k), np.uint8)).ravel()
    line = cv2.GaussianBlur(line.reshape(1, -1), (1, 0), sigmaX=k / 2).ravel() if False else np.convolve(np.pad(line, k, mode="edge"), np.ones(k) / k, mode="same")[k:-k]
    hg = th * .42; upper = line - hg
    band = np.zeros((H, W), bool); yy = np.arange(H)[:, None]
    span = np.zeros(W, bool); span[x0:x1 + 1] = True
    band = (yy >= upper[None, :]) & (yy <= top[None, :] + 2) & span[None, :] & ~tm
    # المحتوى: اللثة الحقيقية، والباقي يتملي من نسيجها
    lab = cv2.cvtColor(a, cv2.COLOR_RGB2LAB).astype(np.float32)
    gum = band & (lab[..., 1] > 134) & (lab[..., 0] > 35)
    fill = (band & ~gum).astype(np.uint8)
    img = a.copy()
    if fill.any() and gum.any():
        img = cv2.inpaint(a, fill, max(3, int(th * .05)), cv2.INPAINT_TELEA)
        img = np.where((fill > 0)[..., None], cv2.GaussianBlur(img, (0, 0), 1.5), img)
    # الشفافية: السنان واللثة كاملين، وحافة الشريط العليا بتخفت على ٢٥٪ من ارتفاعه، والأطراف يمين وشمال كمان
    fade_top = np.clip((yy - upper[None, :]) / max(2.0, hg * .25), 0, 1)
    edge = max(3.0, (x1 - x0) * .03)
    fade_x = np.clip(np.minimum(xx - x0, x1 - xx) / edge, 0, 1)[None, :]
    al = np.where(tm, 1.0, np.where(band, fade_top * fade_x, 0)).astype(np.float32)
    al = cv2.GaussianBlur(al, (0, 0), 1.0)[..., None]
    return (img * al).astype(np.uint8), (al[..., 0] > .05)


def _smooth_fill(m):
    """حدود ناعمة ومفيش فراغات جوه (الضل بين السنان واللثة بيفضل جزء من الصورة، مش خرم أسود)."""
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    n, lb, st, _ = cv2.connectedComponentsWithStats(m)
    if n > 1:   # الحتت الصغيرة اللي لوحدها (لمعة على المبعد/الشفة) تتشال
        big = st[1:, 4].max(); m = np.isin(lb, [i for i in range(1, n) if st[i, 4] >= big * .04]).astype(np.uint8)
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    f = np.zeros_like(m); cv2.drawContours(f, cs, -1, 1, -1)
    k = max(3, int(np.sqrt(f.sum()) * .012)) | 1
    return cv2.GaussianBlur(f.astype(np.float32), (k, k), 0) > .5


def _grab(a, tm, out, box):
    H, W = a.shape[:2]; x0, y0, x1, y1 = box; bw, bh = x1 - x0, y1 - y0
    X0, Y0 = int(max(0, x0 - bw * .08)), int(max(0, y0 - bh * .9)); X1, Y1 = int(min(W, x1 + bw * .08)), int(min(H, y1 + bh * .5))
    roi = a[Y0:Y1, X0:X1]; k = min(1.0, 700 / max(roi.shape[:2])); sm = cv2.resize(roi, None, fx=k, fy=k, interpolation=cv2.INTER_AREA)
    rz = lambda m: cv2.resize(m[Y0:Y1, X0:X1].astype(np.uint8), (sm.shape[1], sm.shape[0]), interpolation=cv2.INTER_NEAREST) > 0
    t, o = rz(tm), rz(out)
    g = np.full(sm.shape[:2], cv2.GC_PR_BGD, np.uint8)
    g[cv2.dilate(o.astype(np.uint8), np.ones((7, 7), np.uint8)) > 0] = cv2.GC_PR_FGD
    g[cv2.erode(t.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0] = cv2.GC_FGD
    # اللثة اللي لازقة في السنان (حمرا، ولو غامقة) أكيد جزء من الصورة — عشان GrabCut مايشيلهاش مع الخلفية الغامقة
    labs = cv2.cvtColor(sm, cv2.COLOR_RGB2LAB).astype(np.float32)
    th_ = max(3, int(bh * k * .22)); near = cv2.dilate(t.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (th_ * 2 + 1, th_ * 2 + 1))) > 0
    g[near & ~t & (labs[..., 1] > 136) & (labs[..., 0] > 30)] = cv2.GC_FGD
    g[(cv2.cvtColor(sm, cv2.COLOR_RGB2GRAY) < 18)] = cv2.GC_BGD   # أسود (خلفية/جوه البق)
    try:
        bg, fg = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
        cv2.grabCut(cv2.cvtColor(sm, cv2.COLOR_RGB2BGR), g, None, bg, fg, 5, cv2.GC_INIT_WITH_MASK)
    except cv2.error:
        return out, tm
    r = ((g == cv2.GC_FGD) | (g == cv2.GC_PR_FGD)).astype(np.uint8)
    full = np.zeros((H, W), bool); full[Y0:Y1, X0:X1] = cv2.resize(r, (X1 - X0, Y1 - Y0), interpolation=cv2.INTER_LINEAR) > 0
    # السنان = الجزء الفاتح غير الأحمر جوه النتيجة (للتدرّج: السنان ثابتة واللثة بتخفت)
    lab = cv2.cvtColor(a, cv2.COLOR_RGB2LAB).astype(np.float32)
    toothy = (lab[..., 0] > 120) & (lab[..., 1] < 146)
    tm2 = (full & toothy) | (tm & full)
    tm2 = cv2.morphologyEx(tm2.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8)) > 0
    return full, tm2


# ---------- هوية الدكتور ----------
def strip_bg(lg):
    """شعار جاي بخلفية (أبيض/لون واحد): الخلفية تتشال، والشعار بس يفضل (بحواف ناعمة).
    لو الشعار شفاف أصلًا يفضل زي ما هو. الخلفية = لون حافة الصورة (لو الحافة لون واحد تقريبًا)."""
    a = np.array(lg.convert("RGBA")).astype(np.float32)
    if (a[..., 3] < 250).mean() > .03: return lg   # شفاف أصلًا
    h, w = a.shape[:2]; b = max(2, int(min(h, w) * .03))
    edge = np.concatenate([a[:b].reshape(-1, 4), a[-b:].reshape(-1, 4), a[:, :b].reshape(-1, 4), a[:, -b:].reshape(-1, 4)])[:, :3]
    bg = np.median(edge, 0)
    if np.percentile(np.linalg.norm(edge - bg, axis=1), 90) > 28:
        return lg   # الحافة مش لون واحد (صورة/تدرّج): مانلمسهوش أحسن ما نبوّظه
    dist = np.linalg.norm(a[..., :3] - bg, axis=2)
    al = np.clip((dist - 14) / 36, 0, 1)
    al = cv2.GaussianBlur(al, (0, 0), .7)
    # فك امتزاج لون الحافة مع الخلفية (عشان مايبقاش حواليه هالة بيضا على الصور الغامقة)
    k = np.maximum(al, 1e-3)[..., None]
    rgb = np.clip((a[..., :3] - bg * (1 - k)) / k, 0, 255)
    out = np.dstack([rgb, al * 255]).astype(np.uint8)
    im = Image.fromarray(out, "RGBA"); bb = im.getbbox()
    return im.crop(bb) if bb else lg


def logo_img(brand, h=None, w=None, color=None):
    lg = strip_bg(Image.open(brand["logo"] if os.path.isabs(brand["logo"]) else S + brand["logo"]).convert("RGBA"))
    k = (h / lg.height) if h else (w / lg.width)
    lg = lg.resize((max(1, int(lg.width * k)), max(1, int(lg.height * k))), Image.LANCZOS)
    if color:
        al = lg.split()[3]; lg = Image.new("RGBA", lg.size, color + (255,)); lg.putalpha(al)
    return lg


def paste_logo(cv, brand, cx, cy, h=None, w=None, rot=0, alpha=1.0):
    lg = logo_img(brand, h, w)
    # شعار غامق فوق مكان غامق (أسود/ضل): بيتلوّن أبيض عشان يبان — زي شعارات العيادات على الأسود
    la = np.array(lg).astype(np.float32); on = la[..., 3] > 128
    x0, y0 = int(max(0, cx - lg.width / 2)), int(max(0, cy - lg.height / 2))
    reg = np.array(cv.convert("RGB").crop((x0, y0, min(cv.width, x0 + lg.width), min(cv.height, y0 + lg.height)))).astype(np.float32)
    blum = float(reg.mean()) if reg.size else 0
    low = float((np.abs(la[..., :3].mean(2)[on] - blum) < 60).mean()) if on.any() else 0   # جزء الشعار اللي مش باين على الخلفية
    if low > .06:
        lg = logo_img(brand, h, w, color=(255, 255, 255) if blum < 128 else (20, 20, 22))
    if rot: lg = lg.rotate(rot, expand=True, resample=Image.BICUBIC)
    if alpha < 1: lg.putalpha(lg.split()[3].point(lambda v: int(v * alpha)))
    cv.paste(lg, (int(cx - lg.width / 2), int(cy - lg.height / 2)), lg); return cv


def spaced(d, text, x0, x1, y, size=17, col=(235, 235, 238, 255)):
    letters = list(text.upper().replace(" ", "  ")); f = font(FONTS.EN, size); n = len(letters); step = (x1 - x0) / max(n - 1, 1)
    for i, ch in enumerate(letters):
        if ch.strip(): d.text((x0 + i * step, y), ch, font=f, fill=col, anchor="mm")


def spaced_v(cv, text, x, y0, y1, size=17, col=(235, 235, 238, 255)):
    """اسم بحروف متباعدة بالطول (لقوالب الصور المتلفّة)."""
    L = int(y1 - y0); band = Image.new("RGBA", (L, size * 2)); spaced(ImageDraw.Draw(band), text, size, L - size, size, size, col)
    band = band.rotate(-90, expand=True); cv.paste(band, (int(x - band.width / 2), int(y0)), band); return cv


def footer(cv, brand, W, H, h=150, logo_h=74):
    """شريط تحت: تدرّج غامق + جملة (يسار) + لوجو (نص) + رقم (يمين)."""
    g = np.zeros((h, W, 4), np.uint8); g[..., 3] = (np.linspace(0, 1, h) ** 1.6 * 170).astype(np.uint8)[:, None]
    gi = Image.fromarray(g, "RGBA"); cv.paste(gi, (0, H - h), gi)
    paste_logo(cv, brand, W / 2, H - 26 - logo_h / 2, h=logo_h)
    d = ImageDraw.Draw(cv, "RGBA"); yb = H - 46
    if brand.get("slogan"): d.text((40, yb), brand["slogan"], font=font(FONTS.AR, 24), fill=(245, 245, 247), anchor="lm")
    if brand.get("phone"): d.text((W - 40, yb), brand["phone"], font=font(FONTS.EN, 26), fill=(245, 245, 247), anchor="rm")
    return cv


def to_img(a): return Image.fromarray(a).convert("RGB")
